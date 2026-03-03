import argparse
from datetime import UTC
from datetime import datetime
from io import BytesIO
import time

from PIL import Image
from PIL import ImageFilter
from sqlalchemy import asc
from sqlalchemy import desc
from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.db import models as db_models
from apps.api.db.session import get_session_local
from apps.api.services.artifact_store import LocalArtifactStore
from apps.worker.fake_adapters import render_placeholder_png
from apps.worker.model_adapters import resolve_adapter


_artifact_store: LocalArtifactStore | None = None


def get_artifact_store() -> LocalArtifactStore:
    global _artifact_store
    if _artifact_store is None:
        _artifact_store = LocalArtifactStore.from_env()
    return _artifact_store


def run_once() -> None:
    print("worker heartbeat: ok")


def _append_job_log(job: db_models.Job, message: str) -> None:
    logs = list(job.logs_json or [])
    logs.append(message)
    job.logs_json = logs


def _claim_next_job(db: Session) -> db_models.Job | None:
    stmt = (
        select(db_models.Job)
        .where(db_models.Job.status == "QUEUED")
        .order_by(desc(db_models.Job.priority), asc(db_models.Job.created_at))
        .limit(1)
    )
    job = db.execute(stmt).scalar_one_or_none()
    if job is None:
        return None

    job.status = "RUNNING"
    job.started_at = datetime.now(UTC)
    _append_job_log(job, "Job claimed by worker")
    db.commit()
    db.refresh(job)
    return job


def _to_float(value: object, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_int(value: object, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _extract_scene_spec(job: db_models.Job) -> dict[str, object] | None:
    payload = job.input_json or {}
    if not isinstance(payload, dict):
        return None
    scene_spec = payload.get("scene_spec")
    if not isinstance(scene_spec, dict):
        return None
    return scene_spec


def _target_object_id(input_payload: object) -> str | None:
    if not isinstance(input_payload, dict):
        return None
    value = input_payload.get("target_object_id")
    if isinstance(value, str) and value:
        return value
    return None


def _latest_object_artifacts(db: Session, scene_id: str) -> tuple[dict[str, str], dict[str, str]]:
    stmt = (
        select(db_models.Job)
        .where(
            db_models.Job.scene_id == scene_id,
            db_models.Job.status == "SUCCEEDED",
            db_models.Job.job_type.in_(["OBJECT_RENDER", "SKETCH"]),
        )
        .order_by(desc(db_models.Job.created_at))
    )
    jobs = db.execute(stmt).scalars().all()

    latest_render_by_object: dict[str, str] = {}
    latest_sketch_by_object: dict[str, str] = {}
    for candidate in jobs:
        object_id = _target_object_id(candidate.input_json)
        if object_id is None:
            continue

        outputs = candidate.output_artifact_ids or []
        artifact_id = outputs[0] if isinstance(outputs, list) and outputs else None
        if not isinstance(artifact_id, str) or not artifact_id:
            continue

        if candidate.job_type == "OBJECT_RENDER" and object_id not in latest_render_by_object:
            latest_render_by_object[object_id] = artifact_id
        elif candidate.job_type == "SKETCH" and object_id not in latest_sketch_by_object:
            latest_sketch_by_object[object_id] = artifact_id

    return latest_render_by_object, latest_sketch_by_object


def _resolve_canvas_size(scene_spec: dict[str, object]) -> tuple[int, int]:
    default_width = 820
    default_height = 520

    settings = scene_spec.get("settings")
    if not isinstance(settings, dict):
        return default_width, default_height

    canvas = settings.get("canvas")
    if not isinstance(canvas, dict):
        return default_width, default_height

    width = max(1, _to_int(canvas.get("width"), default_width))
    height = max(1, _to_int(canvas.get("height"), default_height))
    return width, height


def _ordered_visible_objects(scene_spec: dict[str, object]) -> list[dict[str, object]]:
    layers = scene_spec.get("layers")
    objects = scene_spec.get("objects")
    if not isinstance(layers, list) or not isinstance(objects, list):
        return []

    visible_layer_order: dict[str, float] = {}
    for layer in layers:
        if not isinstance(layer, dict):
            continue
        if layer.get("visible") is False:
            continue
        layer_id = layer.get("id")
        if not isinstance(layer_id, str) or not layer_id:
            continue
        visible_layer_order[layer_id] = _to_float(layer.get("order"), 0)

    sortable: list[tuple[float, float, dict[str, object]]] = []
    for object_payload in objects:
        if not isinstance(object_payload, dict):
            continue
        object_id = object_payload.get("id")
        layer_id = object_payload.get("layer_id")
        if not isinstance(object_id, str) or not isinstance(layer_id, str):
            continue
        if layer_id not in visible_layer_order:
            continue

        transform = object_payload.get("transform")
        if not isinstance(transform, dict):
            transform = {}

        sortable.append(
            (
                visible_layer_order[layer_id],
                _to_float(transform.get("z_index"), 0),
                {
                    "id": object_id,
                    "x": _to_float(transform.get("x"), 0),
                    "y": _to_float(transform.get("y"), 0),
                    "scale_x": max(0.05, _to_float(transform.get("scale_x"), 1)),
                    "scale_y": max(0.05, _to_float(transform.get("scale_y"), 1)),
                    "rotation_deg": _to_float(transform.get("rotation_deg"), 0),
                    "width": max(1, _to_int(transform.get("width"), 120)),
                    "height": max(1, _to_int(transform.get("height"), 84)),
                },
            )
        )

    sortable.sort(key=lambda entry: (entry[0], entry[1]))
    return [entry[2] for entry in sortable]


def _render_final_composite(db: Session, job: db_models.Job) -> tuple[bytes, int, int, int]:
    scene_spec = _extract_scene_spec(job)
    if scene_spec is None:
        fallback = render_placeholder_png(job_type=job.job_type, scene_id=job.scene_id, job_id=job.id)
        return fallback.png_bytes, fallback.width, fallback.height, 0

    width, height = _resolve_canvas_size(scene_spec)
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    artifact_store = get_artifact_store()
    latest_render_by_object, latest_sketch_by_object = _latest_object_artifacts(db, job.scene_id)
    composed_objects = 0

    for object_payload in _ordered_visible_objects(scene_spec):
        object_id = object_payload.get("id")
        if not isinstance(object_id, str):
            continue

        artifact_id = latest_render_by_object.get(object_id) or latest_sketch_by_object.get(object_id)
        if artifact_id is None:
            continue

        stored_artifact = artifact_store.get(artifact_id)
        if stored_artifact is None:
            _append_job_log(job, f"Skipping missing artifact {artifact_id} for object {object_id}")
            continue

        try:
            with Image.open(stored_artifact.file_path) as source_image:
                rgba_image = source_image.convert("RGBA")
        except Exception as exc:
            _append_job_log(job, f"Failed to decode artifact {artifact_id}: {exc}")
            continue

        width_px = max(1, int(round(_to_float(object_payload.get("width"), 120) * _to_float(object_payload.get("scale_x"), 1))))
        height_px = max(1, int(round(_to_float(object_payload.get("height"), 84) * _to_float(object_payload.get("scale_y"), 1))))

        resized_image = rgba_image.resize((width_px, height_px), Image.Resampling.BICUBIC)
        rotation_deg = _to_float(object_payload.get("rotation_deg"), 0)
        placed_image = (
            resized_image.rotate(-rotation_deg, expand=True, resample=Image.Resampling.BICUBIC)
            if rotation_deg
            else resized_image
        )

        center_x = _to_float(object_payload.get("x"), 0) + width_px / 2
        center_y = _to_float(object_payload.get("y"), 0) + height_px / 2
        paste_x = int(round(center_x - placed_image.width / 2))
        paste_y = int(round(center_y - placed_image.height / 2))
        canvas.paste(placed_image, (paste_x, paste_y), placed_image)
        composed_objects += 1

    output = BytesIO()
    canvas.save(output, format="PNG")
    return output.getvalue(), width, height, composed_objects


def _input_payload(job: db_models.Job) -> dict[str, object]:
    payload = job.input_json
    if isinstance(payload, dict):
        return payload
    return {}


def _zone_bounds(zone_payload: dict[str, object], canvas_width: int, canvas_height: int) -> tuple[int, int, int, int]:
    shape = zone_payload.get("shape")
    if not isinstance(shape, dict):
        return (0, 0, 1, 1)

    shape_type = shape.get("type")
    if shape_type == "lasso":
        points = shape.get("points")
        if isinstance(points, list):
            valid_points = [
                (_to_float(point.get("x"), 0), _to_float(point.get("y"), 0))
                for point in points
                if isinstance(point, dict)
            ]
            if len(valid_points) >= 3:
                xs = [point[0] for point in valid_points]
                ys = [point[1] for point in valid_points]
                min_x = int(max(0, min(xs)))
                min_y = int(max(0, min(ys)))
                max_x = int(min(canvas_width, max(xs)))
                max_y = int(min(canvas_height, max(ys)))
                return (
                    min_x,
                    min_y,
                    max(1, max_x - min_x),
                    max(1, max_y - min_y),
                )

    x = max(0, _to_int(shape.get("x"), 0))
    y = max(0, _to_int(shape.get("y"), 0))
    width = max(1, _to_int(shape.get("width"), 1))
    height = max(1, _to_int(shape.get("height"), 1))
    if x + width > canvas_width:
        width = max(1, canvas_width - x)
    if y + height > canvas_height:
        height = max(1, canvas_height - y)
    return (x, y, width, height)


def _intersects(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> bool:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return ax < bx + bw and ax + aw > bx and ay < by + bh and ay + ah > by


def _infer_zone_object_ids(
    zone_bounds: tuple[int, int, int, int],
    ordered_objects: list[dict[str, object]],
) -> list[str]:
    included: list[str] = []
    for object_payload in ordered_objects:
        object_id = object_payload.get("id")
        if not isinstance(object_id, str):
            continue
        object_bounds = (
            _to_int(object_payload.get("x"), 0),
            _to_int(object_payload.get("y"), 0),
            max(1, _to_int(object_payload.get("width"), 1)),
            max(1, _to_int(object_payload.get("height"), 1)),
        )
        if _intersects(zone_bounds, object_bounds):
            included.append(object_id)
    return included


def _zone_relation_ids(scene_spec: dict[str, object], object_ids: set[str]) -> list[str]:
    relation_ids: list[str] = []
    relations = scene_spec.get("relations")
    if not isinstance(relations, list):
        return relation_ids

    for relation in relations:
        if not isinstance(relation, dict):
            continue
        relation_id = relation.get("id")
        subject = relation.get("subject_object_id")
        object_ref = relation.get("object_object_id")
        if (
            isinstance(relation_id, str)
            and isinstance(subject, str)
            and isinstance(object_ref, str)
            and subject in object_ids
            and object_ref in object_ids
        ):
            relation_ids.append(relation_id)

    return relation_ids


def _image_to_png_bytes(image: Image.Image) -> bytes:
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def _render_zone_composite(
    db: Session,
    job: db_models.Job,
) -> tuple[bytes, int, int, dict[str, object], list[dict[str, object]]]:
    scene_spec = _extract_scene_spec(job)
    if scene_spec is None:
        fallback = render_placeholder_png(job_type=job.job_type, scene_id=job.scene_id, job_id=job.id)
        return (
            fallback.png_bytes,
            fallback.width,
            fallback.height,
            {"adapter": "simple_zone_v1", "job_id": job.id, "composed_zone_count": 0},
            [],
        )

    width, height = _resolve_canvas_size(scene_spec)
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    artifact_store = get_artifact_store()
    latest_render_by_object, latest_sketch_by_object = _latest_object_artifacts(db, job.scene_id)
    ordered_objects = _ordered_visible_objects(scene_spec)
    object_by_id = {
        object_payload["id"]: object_payload
        for object_payload in ordered_objects
        if isinstance(object_payload.get("id"), str)
    }
    zones = scene_spec.get("zones")
    if not isinstance(zones, list):
        zones = []

    zone_artifacts: list[dict[str, object]] = []
    composed_zone_count = 0

    for zone_index, zone_payload in enumerate(zones):
        if not isinstance(zone_payload, dict):
            continue

        zone_id = zone_payload.get("id")
        zone_name = zone_payload.get("name")
        if not isinstance(zone_id, str):
            zone_id = f"zone_{zone_index + 1}"
        if not isinstance(zone_name, str):
            zone_name = zone_id

        zone_x, zone_y, zone_width, zone_height = _zone_bounds(zone_payload, width, height)
        zone_canvas = Image.new("RGBA", (zone_width, zone_height), (0, 0, 0, 0))

        included_object_ids = zone_payload.get("included_object_ids")
        if isinstance(included_object_ids, list):
            zone_object_ids = [
                object_id
                for object_id in included_object_ids
                if isinstance(object_id, str) and object_id in object_by_id
            ]
        else:
            zone_object_ids = []
        if not zone_object_ids:
            zone_object_ids = _infer_zone_object_ids((zone_x, zone_y, zone_width, zone_height), ordered_objects)
        zone_object_set = set(zone_object_ids)
        relation_ids = _zone_relation_ids(scene_spec, zone_object_set)

        rendered_object_count = 0
        for object_payload in ordered_objects:
            object_id = object_payload.get("id")
            if not isinstance(object_id, str) or object_id not in zone_object_set:
                continue

            artifact_id = latest_render_by_object.get(object_id) or latest_sketch_by_object.get(object_id)
            if artifact_id is None:
                continue

            stored_artifact = artifact_store.get(artifact_id)
            if stored_artifact is None:
                _append_job_log(job, f"Zone {zone_id}: missing artifact {artifact_id} for object {object_id}")
                continue

            try:
                with Image.open(stored_artifact.file_path) as source_image:
                    rgba_image = source_image.convert("RGBA")
            except Exception as exc:
                _append_job_log(job, f"Zone {zone_id}: failed to decode artifact {artifact_id}: {exc}")
                continue

            width_px = max(
                1,
                int(round(_to_float(object_payload.get("width"), 120) * _to_float(object_payload.get("scale_x"), 1))),
            )
            height_px = max(
                1,
                int(round(_to_float(object_payload.get("height"), 84) * _to_float(object_payload.get("scale_y"), 1))),
            )
            resized_image = rgba_image.resize((width_px, height_px), Image.Resampling.BICUBIC)
            rotation_deg = _to_float(object_payload.get("rotation_deg"), 0)
            placed_image = (
                resized_image.rotate(-rotation_deg, expand=True, resample=Image.Resampling.BICUBIC)
                if rotation_deg
                else resized_image
            )

            center_x = _to_float(object_payload.get("x"), 0) + width_px / 2
            center_y = _to_float(object_payload.get("y"), 0) + height_px / 2
            paste_x = int(round(center_x - placed_image.width / 2 - zone_x))
            paste_y = int(round(center_y - placed_image.height / 2 - zone_y))
            zone_canvas.paste(placed_image, (paste_x, paste_y), placed_image)
            rendered_object_count += 1

        canvas.paste(zone_canvas, (zone_x, zone_y), zone_canvas)
        composed_zone_count += 1
        _append_job_log(
            job,
            f"Zone {zone_name} ({zone_id}) rendered with {rendered_object_count} object(s) and {len(relation_ids)} relation(s)",
        )

        zone_artifacts.append(
            {
                "png_bytes": _image_to_png_bytes(zone_canvas),
                "width": zone_width,
                "height": zone_height,
                "subtype": "ZONE",
                "metadata": {
                    "adapter": "simple_zone_v1",
                    "job_id": job.id,
                    "zone_id": zone_id,
                    "zone_name": zone_name,
                    "included_object_ids": zone_object_ids,
                    "relation_ids": relation_ids,
                    "rendered_object_count": rendered_object_count,
                },
            }
        )

    return (
        _image_to_png_bytes(canvas),
        width,
        height,
        {
            "adapter": "simple_zone_v1",
            "job_id": job.id,
            "composed_zone_count": composed_zone_count,
            "zone_artifact_count": len(zone_artifacts),
        },
        zone_artifacts,
    )


def _latest_scene_artifact_for_job_types(
    db: Session,
    scene_id: str,
    job_types: list[str],
) -> str | None:
    stmt = (
        select(db_models.Job)
        .where(
            db_models.Job.scene_id == scene_id,
            db_models.Job.status == "SUCCEEDED",
            db_models.Job.job_type.in_(job_types),
        )
        .order_by(desc(db_models.Job.created_at))
    )
    jobs = db.execute(stmt).scalars().all()
    for candidate in jobs:
        outputs = candidate.output_artifact_ids or []
        artifact_id = outputs[0] if isinstance(outputs, list) and outputs else None
        if isinstance(artifact_id, str) and artifact_id:
            return artifact_id
    return None


def _refine_strength(scene_spec: dict[str, object] | None) -> float:
    if not isinstance(scene_spec, dict):
        return 0.25
    settings = scene_spec.get("settings")
    if not isinstance(settings, dict):
        return 0.25
    defaults = settings.get("defaults")
    if not isinstance(defaults, dict):
        return 0.25
    return min(1.0, max(0.0, _to_float(defaults.get("refine_strength"), 0.25)))


def _render_refinement_pass(
    db: Session,
    job: db_models.Job,
) -> tuple[bytes, int, int, dict[str, object]]:
    scene_spec = _extract_scene_spec(job)
    input_payload = _input_payload(job)
    source_artifact_id = input_payload.get("source_artifact_id")
    if not isinstance(source_artifact_id, str) or not source_artifact_id:
        source_artifact_id = _latest_scene_artifact_for_job_types(
            db,
            job.scene_id,
            ["ZONE_RENDER", "FINAL_COMPOSITE", "REFINE"],
        )

    strength = _refine_strength(scene_spec)
    source_image: Image.Image | None = None

    if source_artifact_id:
        stored_artifact = get_artifact_store().get(source_artifact_id)
        if stored_artifact is not None:
            with Image.open(stored_artifact.file_path) as source:
                source_image = source.convert("RGBA")

    if source_image is None:
        if scene_spec is not None:
            fallback_png, width, height, _ = _render_final_composite(db, job)
            with Image.open(BytesIO(fallback_png)) as fallback:
                source_image = fallback.convert("RGBA")
            source_artifact_id = "generated_fallback_composite"
        else:
            fallback = render_placeholder_png(job_type="FINAL_COMPOSITE", scene_id=job.scene_id, job_id=job.id)
            with Image.open(BytesIO(fallback.png_bytes)) as fallback_image:
                source_image = fallback_image.convert("RGBA")
            source_artifact_id = "generated_fallback_placeholder"

    blur_radius = max(0.5, 2.4 * strength)
    softened = source_image.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    blend_alpha = min(0.6, max(0.08, 0.55 * strength))
    blended = Image.blend(source_image, softened, blend_alpha)
    refined = blended.filter(
        ImageFilter.UnsharpMask(radius=1.2, percent=max(40, int(60 + 90 * strength)), threshold=3)
    )

    return (
        _image_to_png_bytes(refined),
        refined.width,
        refined.height,
        {
            "adapter": "simple_refine_v1",
            "job_id": job.id,
            "source_artifact_id": source_artifact_id,
            "refine_strength": round(strength, 2),
            "seam_reduction": "gaussian_blend_unsharp",
        },
    )


def _persist_artifact(
    db: Session,
    job: db_models.Job,
    png_bytes: bytes,
    subtype: str,
    width: int,
    height: int,
    metadata_json: dict[str, object],
) -> str:
    artifact_store = get_artifact_store()
    artifact_record = artifact_store.create(
        data=png_bytes,
        filename=f"{job.id}.png",
        content_type="image/png",
        scene_id=job.scene_id,
        artifact_type="IMAGE",
        subtype=subtype,
    )

    artifact = db_models.Artifact(
        id=artifact_record.id,
        scene_id=job.scene_id,
        type="IMAGE",
        subtype=subtype,
        uri=artifact_record.uri,
        width=width,
        height=height,
        format="png",
        metadata_json=metadata_json,
    )
    db.add(artifact)
    return artifact.id


def _render_model_adapter_job(
    job: db_models.Job,
) -> tuple[bytes, int, int, str, dict[str, object], bytes | None, str | None]:
    adapter = resolve_adapter(job.job_type)
    result = adapter.render(
        scene_id=job.scene_id,
        job_id=job.id,
        input_payload=job.input_json or {},
    )
    metadata = {
        "adapter": result.adapter_name,
        "job_id": job.id,
    }
    return (
        result.png_bytes,
        result.width,
        result.height,
        result.subtype,
        metadata,
        result.mask_png_bytes,
        result.mask_subtype,
    )


def process_one_job() -> bool:
    session_local = get_session_local()
    db = session_local()
    try:
        job = _claim_next_job(db)
        if job is None:
            print("worker: no queued jobs")
            return False

        _append_job_log(job, f"Processing job {job.id} ({job.job_type})")

        mask_png: bytes | None = None
        mask_subtype: str | None = None
        extra_artifact_ids: list[str] = []

        if job.job_type == "FINAL_COMPOSITE":
            composite_png, width, height, composed_objects = _render_final_composite(db=db, job=job)
            subtype = "COMPOSITE"
            metadata_json: dict[str, object] = {
                "adapter": "simple_alpha_v1",
                "job_id": job.id,
                "composed_object_count": composed_objects,
            }
            _append_job_log(job, f"Composited {composed_objects} object artifact(s)")
            _append_job_log(job, "Final composite rendered via simple alpha pass")
        elif job.job_type == "ZONE_RENDER":
            (
                composite_png,
                width,
                height,
                metadata_json,
                zone_artifacts,
            ) = _render_zone_composite(db=db, job=job)
            subtype = "COMPOSITE"
            for zone_artifact in zone_artifacts:
                zone_artifact_id = _persist_artifact(
                    db=db,
                    job=job,
                    png_bytes=zone_artifact["png_bytes"],
                    subtype=str(zone_artifact["subtype"]),
                    width=_to_int(zone_artifact["width"], 1),
                    height=_to_int(zone_artifact["height"], 1),
                    metadata_json=zone_artifact["metadata"] if isinstance(zone_artifact["metadata"], dict) else {},
                )
                extra_artifact_ids.append(zone_artifact_id)
            _append_job_log(job, f"Generated {len(extra_artifact_ids)} zone artifact(s)")
            _append_job_log(job, "Zone render pipeline stitched zones into composite")
        elif job.job_type == "REFINE":
            composite_png, width, height, metadata_json = _render_refinement_pass(db=db, job=job)
            subtype = "REFINED"
            _append_job_log(job, f"Refinement pass applied at strength {metadata_json.get('refine_strength')}")
        else:
            (
                composite_png,
                width,
                height,
                subtype,
                metadata_json,
                mask_png,
                mask_subtype,
            ) = _render_model_adapter_job(job)
            _append_job_log(job, f"Rendered via adapter {metadata_json['adapter']}")

        artifact_id = _persist_artifact(
            db=db,
            job=job,
            png_bytes=composite_png,
            subtype=subtype,
            width=width,
            height=height,
            metadata_json=metadata_json,
        )

        job.status = "SUCCEEDED"
        job.finished_at = datetime.now(UTC)
        output_artifact_ids = [artifact_id, *extra_artifact_ids]
        if mask_png and mask_subtype:
            mask_artifact_id = _persist_artifact(
                db=db,
                job=job,
                png_bytes=mask_png,
                subtype=mask_subtype,
                width=width,
                height=height,
                metadata_json={"adapter": metadata_json.get("adapter"), "job_id": job.id, "kind": "mask"},
            )
            output_artifact_ids.append(mask_artifact_id)
            _append_job_log(job, f"Generated mask artifact {mask_artifact_id}")
        job.output_artifact_ids = output_artifact_ids
        _append_job_log(job, f"Generated artifact {artifact_id}")
        _append_job_log(job, "Job completed successfully")
        db.commit()

        print(f"worker: processed {job.id}")
        return True
    except Exception as exc:
        db.rollback()

        # Try to update the currently claimed job as failed.
        if "job" in locals() and job is not None:
            job.status = "FAILED"
            job.error = str(exc)
            job.finished_at = datetime.now(UTC)
            _append_job_log(job, f"Job failed: {exc}")
            db.commit()

        print(f"worker error: {exc}")
        return False
    finally:
        db.close()


def run_forever(interval_seconds: int = 10, poll_jobs: bool = False) -> None:
    while True:
        run_once()
        if poll_jobs:
            process_one_job()
        time.sleep(interval_seconds)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="AI Image Composer worker scaffold")
    parser.add_argument("--once", action="store_true", help="Run one heartbeat and exit")
    parser.add_argument("--run-job-once", action="store_true", help="Claim and process one queued job")
    parser.add_argument("--poll-jobs", action="store_true", help="Poll for queued jobs while running")
    parser.add_argument(
        "--interval",
        type=int,
        default=10,
        help="Heartbeat interval in seconds when running continuously",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.once:
        run_once()
        return
    if args.run_job_once:
        process_one_job()
        return
    run_forever(interval_seconds=args.interval, poll_jobs=args.poll_jobs)


if __name__ == "__main__":
    main()
