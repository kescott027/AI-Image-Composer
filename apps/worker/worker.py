import argparse
from datetime import UTC
from datetime import datetime
from io import BytesIO
import time

from PIL import Image
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
        output_artifact_ids = [artifact_id]
        if job.job_type != "FINAL_COMPOSITE" and mask_png and mask_subtype:
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
