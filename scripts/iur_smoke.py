#!/usr/bin/env python3
"""Initial Usable Release smoke flows for AI Image Composer.

Supported scenarios:
- mvp: baseline API workflow validation.
- directed-3-layer: person/table/cake directed flow with blocking pass,
  wireframe variants, preferred selection, anchor metadata, ordered render,
  composite, and refine.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from urllib import error, request
from urllib.parse import urlparse

SCENARIO_MVP = "mvp"
SCENARIO_DIRECTED_3_LAYER = "directed-3-layer"


def _validated_http_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("base URL must be an absolute http(s) URL")
    return url.rstrip("/")


@dataclass
class ApiClient:
    base_url: str

    def call(self, method: str, path: str, payload: dict | None = None) -> dict | list:
        body = None
        headers: dict[str, str] = {}
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = request.Request(
            url=f"{self.base_url}{path}",
            method=method,
            data=body,
            headers=headers,
        )

        try:
            with request.urlopen(req, timeout=30) as resp:  # nosec B310
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8")
            raise RuntimeError(f"{method} {path} failed ({exc.code}): {detail}") from exc


def _process_jobs(max_iterations: int) -> int:
    from apps.worker import worker

    processed = 0
    for _ in range(max_iterations):
        if not worker.process_one_job():
            break
        processed += 1
    return processed


def _job_target_object_id(job_payload: dict) -> str | None:
    input_payload = job_payload.get("input")
    if isinstance(input_payload, dict):
        value = input_payload.get("target_object_id")
        if isinstance(value, str) and value:
            return value
    return None


def _job_primary_artifact_id(job_payload: dict) -> str | None:
    output_ids = job_payload.get("output_artifact_ids")
    if isinstance(output_ids, list) and output_ids:
        first = output_ids[0]
        if isinstance(first, str) and first:
            return first
    return None


def _latest_sketch_artifacts_by_object(jobs: list[dict]) -> dict[str, str]:
    by_object: dict[str, str] = {}
    for job in reversed(jobs):
        if job.get("job_type") != "SKETCH":
            continue
        object_id = _job_target_object_id(job)
        if not object_id:
            continue
        artifact_id = _job_primary_artifact_id(job)
        if artifact_id and object_id not in by_object:
            by_object[object_id] = artifact_id
    return by_object


def _build_scene_spec_mvp(scene_id: str, title: str) -> dict:
    timestamp = datetime.now(UTC).isoformat()
    return {
        "schema_version": "0.1.0",
        "scene": {
            "id": scene_id,
            "title": title,
            "overarching_prompt": "A cinematic campsite at dawn",
            "negative_prompt": "blur, extra limbs",
            "style_preset": "cinematic",
            "updated_at": timestamp,
        },
        "layers": [
            {
                "id": "layer_bg",
                "type": "BACKGROUND",
                "name": "Background",
                "order": 1,
                "visible": True,
                "locked": False,
                "metadata": {},
            },
            {
                "id": "layer_obj",
                "type": "OBJECT",
                "name": "Objects",
                "order": 2,
                "visible": True,
                "locked": False,
                "metadata": {},
            },
            {
                "id": "layer_comp",
                "type": "COMPOSITE",
                "name": "Composite",
                "order": 3,
                "visible": True,
                "locked": False,
                "metadata": {},
            },
        ],
        "objects": [
            {
                "id": "obj_tent",
                "layer_id": "layer_obj",
                "name": "Tent",
                "kind": "prop",
                "prompt": "a detailed canvas tent",
                "negative_prompt": "cartoon",
                "transform": {
                    "x": 160,
                    "y": 220,
                    "scale_x": 1,
                    "scale_y": 1,
                    "rotation_deg": 0,
                    "z_index": 0,
                    "anchor": "top_left",
                    "width": 180,
                    "height": 140,
                },
            },
            {
                "id": "obj_fire",
                "layer_id": "layer_obj",
                "name": "Campfire",
                "kind": "prop",
                "prompt": "small campfire with stones",
                "negative_prompt": "smoke artifacts",
                "transform": {
                    "x": 380,
                    "y": 290,
                    "scale_x": 1,
                    "scale_y": 1,
                    "rotation_deg": 0,
                    "z_index": 1,
                    "anchor": "top_left",
                    "width": 120,
                    "height": 90,
                },
            },
        ],
        "relations": [
            {
                "id": "rel_1",
                "subject_object_id": "obj_fire",
                "predicate": "NEAR",
                "object_object_id": "obj_tent",
                "strength": 1.0,
                "notes": "",
            }
        ],
        "artifacts": [],
        "jobs": [],
        "zones": [],
        "constraints": [],
        "settings": {
            "units": "px",
            "canvas": {"width": 820, "height": 520, "background_color": "transparent"},
            "defaults": {
                "seed_policy": "per_job",
                "sampler": "default",
                "steps": 30,
                "cfg_scale": 7,
                "refine_strength": 0.25,
            },
            "models": {
                "sketch_adapter": "fake_sketch_v1",
                "object_render_adapter": "fake_object_v1",
                "composite_adapter": "simple_alpha_v1",
                "zone_adapter": "simple_zone_v1",
            },
        },
        "history": {"scene_version": 0, "notes": "IUR smoke"},
    }


def _build_scene_spec_directed_3_layer(scene_id: str, title: str) -> dict:
    timestamp = datetime.now(UTC).isoformat()
    return {
        "schema_version": "0.1.0",
        "scene": {
            "id": scene_id,
            "title": title,
            "overarching_prompt": "A cozy birthday celebration at home with warm evening light",
            "negative_prompt": "deformed faces, extra limbs, blurry",
            "style_preset": "illustration",
            "updated_at": timestamp,
        },
        "layers": [
            {
                "id": "layer_bg",
                "type": "BACKGROUND",
                "name": "Blocking Background",
                "order": 1,
                "visible": True,
                "locked": False,
                "metadata": {},
            },
            {
                "id": "layer_person",
                "type": "OBJECT",
                "name": "Person Layer",
                "order": 2,
                "visible": True,
                "locked": False,
                "metadata": {},
            },
            {
                "id": "layer_table",
                "type": "OBJECT",
                "name": "Table Layer",
                "order": 3,
                "visible": True,
                "locked": False,
                "metadata": {},
            },
            {
                "id": "layer_cake",
                "type": "OBJECT",
                "name": "Cake Layer",
                "order": 4,
                "visible": True,
                "locked": False,
                "metadata": {},
            },
            {
                "id": "layer_comp",
                "type": "COMPOSITE",
                "name": "Composite",
                "order": 5,
                "visible": True,
                "locked": False,
                "metadata": {},
            },
        ],
        "objects": [
            {
                "id": "obj_person",
                "layer_id": "layer_person",
                "name": "Person",
                "kind": "person",
                "prompt": "a smiling person standing behind a table, clean silhouette",
                "negative_prompt": "extra arms",
                "transform": {
                    "x": 290,
                    "y": 120,
                    "scale_x": 1,
                    "scale_y": 1,
                    "rotation_deg": 0,
                    "z_index": 0,
                    "anchor": "top_left",
                    "width": 190,
                    "height": 300,
                },
                "metadata": {"anchored": True},
            },
            {
                "id": "obj_table",
                "layer_id": "layer_table",
                "name": "Table",
                "kind": "prop",
                "prompt": "a wooden dining table front-facing, clean silhouette",
                "negative_prompt": "floating",
                "transform": {
                    "x": 220,
                    "y": 330,
                    "scale_x": 1,
                    "scale_y": 1,
                    "rotation_deg": 0,
                    "z_index": 0,
                    "anchor": "top_left",
                    "width": 360,
                    "height": 130,
                },
                "metadata": {"anchored": True},
            },
            {
                "id": "obj_cake",
                "layer_id": "layer_cake",
                "name": "Birthday Cake",
                "kind": "prop",
                "prompt": "a birthday cake with lit candles, centered on table, clean silhouette",
                "negative_prompt": "melted",
                "transform": {
                    "x": 350,
                    "y": 290,
                    "scale_x": 1,
                    "scale_y": 1,
                    "rotation_deg": 0,
                    "z_index": 0,
                    "anchor": "top_left",
                    "width": 120,
                    "height": 120,
                },
                "metadata": {"anchored": True},
            },
        ],
        "relations": [
            {
                "id": "rel_person_table",
                "subject_object_id": "obj_person",
                "predicate": "BEHIND",
                "object_object_id": "obj_table",
                "strength": 1.0,
                "notes": "",
            },
            {
                "id": "rel_cake_table",
                "subject_object_id": "obj_cake",
                "predicate": "ABOVE",
                "object_object_id": "obj_table",
                "strength": 1.0,
                "notes": "",
            },
        ],
        "artifacts": [],
        "jobs": [],
        "zones": [],
        "constraints": [],
        "settings": {
            "units": "px",
            "canvas": {"width": 820, "height": 520, "background_color": "transparent"},
            "defaults": {
                "seed_policy": "per_job",
                "sampler": "default",
                "steps": 32,
                "cfg_scale": 7,
                "refine_strength": 0.35,
            },
            "models": {
                "sketch_adapter": "fake_sketch_v1",
                "object_render_adapter": "fake_object_v1",
                "composite_adapter": "simple_alpha_v1",
                "zone_adapter": "simple_zone_v1",
            },
        },
        "history": {"scene_version": 0, "notes": "Release 0.5 directed 3-layer flow"},
    }


def _queue_job(client: ApiClient, scene_id: str, job_type: str, input_payload: dict) -> dict:
    response = client.call(
        "POST",
        "/jobs",
        {
            "scene_id": scene_id,
            "job_type": job_type,
            "input": input_payload,
        },
    )
    if not isinstance(response, dict) or not isinstance(response.get("id"), str):
        raise RuntimeError(f"Unexpected {job_type} job response payload")
    return response


def _validate_jobs_succeeded(jobs_by_id: dict[str, dict], expected_job_ids: list[str]) -> None:
    for job_id in expected_job_ids:
        status = jobs_by_id.get(job_id, {}).get("status")
        if status != "SUCCEEDED":
            raise RuntimeError(f"Expected job {job_id} to succeed, found status={status!r}")


def _run_mvp_flow(
    client: ApiClient,
    scene_id: str,
    scene_spec: dict,
    *,
    process_jobs: bool,
    max_worker_iterations: int,
) -> dict[str, object]:
    print("[4/8] Saving SceneSpec with prompts, objects, and relations")
    saved_spec = client.call("PUT", f"/scenes/{scene_id}/spec", scene_spec)
    if not isinstance(saved_spec, dict) or saved_spec.get("scene", {}).get("id") != scene_id:
        raise RuntimeError("Saved scene spec does not match requested scene")

    print("[5/8] Saving manual version")
    version = client.call("POST", f"/scenes/{scene_id}/versions", scene_spec)
    if not isinstance(version, dict) or version.get("version", {}).get("version_number", 0) < 2:
        raise RuntimeError("Expected scene version number >= 2 after manual save")

    print("[6/8] Queueing sketch + object render jobs")
    sketch_job = _queue_job(
        client,
        scene_id,
        "SKETCH",
        {"scene_spec": scene_spec, "target_object_id": "obj_tent", "generation_mode": "OBJECT"},
    )
    object_render_job = _queue_job(
        client,
        scene_id,
        "OBJECT_RENDER",
        {"scene_spec": scene_spec, "target_object_id": "obj_tent"},
    )

    print("[7/8] Queueing final composite job")
    composite_job = _queue_job(
        client,
        scene_id,
        "FINAL_COMPOSITE",
        {"scene_spec": scene_spec},
    )

    if process_jobs:
        print("[8/9] Processing queued jobs via worker")
        processed_count = _process_jobs(max_worker_iterations)
        if processed_count < 3:
            raise RuntimeError(
                "Expected at least 3 jobs to be processed in smoke flow; "
                f"processed={processed_count}"
            )

    print("[8/8] Verifying persistence endpoints")
    versions = client.call("GET", f"/scenes/{scene_id}/versions")
    jobs = client.call("GET", f"/jobs?scene_id={scene_id}")

    if not isinstance(versions, list) or len(versions) < 2:
        raise RuntimeError("Expected at least 2 scene versions")
    if not isinstance(jobs, list) or len(jobs) < 3:
        raise RuntimeError("Expected at least 3 jobs")

    if process_jobs:
        jobs_by_id = {
            item["id"]: item
            for item in jobs
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        }
        _validate_jobs_succeeded(
            jobs_by_id,
            [sketch_job["id"], object_render_job["id"], composite_job["id"]],
        )
        composite_artifact_id = _job_primary_artifact_id(jobs_by_id[composite_job["id"]])
        if not composite_artifact_id:
            raise RuntimeError("Composite job has no output artifacts")
        composite_meta = client.call("GET", f"/artifacts/{composite_artifact_id}/meta")
        if not isinstance(composite_meta, dict) or composite_meta.get("subtype") != "COMPOSITE":
            raise RuntimeError("Composite artifact metadata is missing or subtype is not COMPOSITE")

    return {"jobs": len(jobs)}


def _run_directed_3_layer_flow(
    client: ApiClient,
    scene_id: str,
    scene_spec: dict,
    *,
    process_jobs: bool,
    max_worker_iterations: int,
    wireframe_variants: int,
) -> dict[str, object]:
    object_ids = [
        object_payload["id"]
        for object_payload in scene_spec.get("objects", [])
        if isinstance(object_payload, dict) and isinstance(object_payload.get("id"), str)
    ]

    print("[4/11] Saving directed 3-layer SceneSpec")
    saved_spec = client.call("PUT", f"/scenes/{scene_id}/spec", scene_spec)
    if not isinstance(saved_spec, dict) or saved_spec.get("scene", {}).get("id") != scene_id:
        raise RuntimeError("Saved scene spec does not match requested scene")

    print("[5/11] Saving manual version")
    version = client.call("POST", f"/scenes/{scene_id}/versions", scene_spec)
    if not isinstance(version, dict) or version.get("version", {}).get("version_number", 0) < 2:
        raise RuntimeError("Expected scene version number >= 2 after manual save")

    print("[6/11] Queueing blocking layer + object wireframe variants")
    queued_job_ids: list[str] = []
    blocking_job = _queue_job(
        client,
        scene_id,
        "SKETCH",
        {"scene_spec": scene_spec, "generation_mode": "BLOCKING"},
    )
    queued_job_ids.append(blocking_job["id"])

    variant_count = max(1, wireframe_variants)
    for object_id in object_ids:
        for _ in range(variant_count):
            job = _queue_job(
                client,
                scene_id,
                "SKETCH",
                {
                    "scene_spec": scene_spec,
                    "target_object_id": object_id,
                    "generation_mode": "OBJECT",
                },
            )
            queued_job_ids.append(job["id"])

    if process_jobs:
        print("[7/11] Processing blocking + wireframe jobs")
        processed_count = _process_jobs(max_worker_iterations)
        expected = 1 + len(object_ids) * variant_count
        if processed_count < expected:
            raise RuntimeError(
                f"Expected at least {expected} jobs in phase 1, processed={processed_count}"
            )

    print("[8/11] Selecting preferred wireframe candidate per object + persisting anchor state")
    jobs_phase_1 = client.call("GET", f"/jobs?scene_id={scene_id}")
    if not isinstance(jobs_phase_1, list):
        raise RuntimeError("Jobs endpoint returned invalid payload")
    preferred_by_object = _latest_sketch_artifacts_by_object(
        [job for job in jobs_phase_1 if isinstance(job, dict)]
    )

    if process_jobs:
        missing = [object_id for object_id in object_ids if object_id not in preferred_by_object]
        if missing:
            raise RuntimeError(f"Missing sketch artifacts for objects: {', '.join(missing)}")

    for object_payload in scene_spec.get("objects", []):
        if not isinstance(object_payload, dict):
            continue
        object_id = object_payload.get("id")
        if not isinstance(object_id, str):
            continue
        metadata = object_payload.setdefault("metadata", {})
        if isinstance(metadata, dict):
            metadata["anchored"] = True
            preferred = preferred_by_object.get(object_id)
            if preferred:
                metadata["preferred_wireframe_artifact_id"] = preferred

    scene_spec["scene"]["updated_at"] = datetime.now(UTC).isoformat()
    client.call("PUT", f"/scenes/{scene_id}/spec", scene_spec)

    print("[9/11] Queueing ordered object render pipeline + composite + refine")
    for object_id in object_ids:
        input_payload = {
            "scene_spec": scene_spec,
            "target_object_id": object_id,
        }
        preferred = preferred_by_object.get(object_id)
        if preferred:
            input_payload["wireframe_artifact_id"] = preferred
        render_job = _queue_job(client, scene_id, "OBJECT_RENDER", input_payload)
        queued_job_ids.append(render_job["id"])

    composite_job = _queue_job(client, scene_id, "FINAL_COMPOSITE", {"scene_spec": scene_spec})
    queued_job_ids.append(composite_job["id"])
    refine_job = _queue_job(client, scene_id, "REFINE", {"scene_spec": scene_spec})
    queued_job_ids.append(refine_job["id"])

    if process_jobs:
        print("[10/11] Processing render/composite/refine jobs")
        phase_two_expected = len(object_ids) + 2
        processed_count = _process_jobs(max_worker_iterations)
        if processed_count < phase_two_expected:
            raise RuntimeError(
                "Expected at least "
                f"{phase_two_expected} jobs in phase 2, processed={processed_count}"
            )

    print("[11/11] Verifying directed 3-layer persistence + artifact outputs")
    versions = client.call("GET", f"/scenes/{scene_id}/versions")
    jobs = client.call("GET", f"/jobs?scene_id={scene_id}")
    if not isinstance(versions, list) or len(versions) < 2:
        raise RuntimeError("Expected at least 2 scene versions")
    if not isinstance(jobs, list) or len(jobs) < len(queued_job_ids):
        raise RuntimeError("Expected all queued directed-flow jobs to be persisted")

    if process_jobs:
        jobs_by_id = {
            item["id"]: item
            for item in jobs
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        }
        _validate_jobs_succeeded(jobs_by_id, queued_job_ids)

        composite_artifact_id = _job_primary_artifact_id(jobs_by_id[composite_job["id"]])
        refine_artifact_id = _job_primary_artifact_id(jobs_by_id[refine_job["id"]])
        if not composite_artifact_id or not refine_artifact_id:
            raise RuntimeError("Composite/refine jobs are missing output artifacts")

        composite_meta = client.call("GET", f"/artifacts/{composite_artifact_id}/meta")
        refine_meta = client.call("GET", f"/artifacts/{refine_artifact_id}/meta")
        if not isinstance(composite_meta, dict) or composite_meta.get("subtype") != "COMPOSITE":
            raise RuntimeError("Expected composite artifact subtype COMPOSITE")
        if not isinstance(refine_meta, dict) or refine_meta.get("subtype") != "REFINED":
            raise RuntimeError("Expected refine artifact subtype REFINED")

    return {
        "jobs": len(jobs),
        "wireframe_variants_per_object": variant_count,
        "objects": len(object_ids),
    }


def run(
    base_url: str,
    *,
    process_jobs: bool = False,
    max_worker_iterations: int = 16,
    scenario: str = SCENARIO_MVP,
    wireframe_variants: int = 3,
) -> None:
    client = ApiClient(base_url=_validated_http_url(base_url))

    print("[1/3] Creating project")
    project = client.call("POST", "/projects", {"name": "IUR Smoke Project"})
    if not isinstance(project, dict) or not isinstance(project.get("id"), str):
        raise RuntimeError("Project create response is invalid")
    project_id = project["id"]

    print("[2/3] Creating scene")
    scene = client.call(
        "POST",
        "/scenes",
        {
            "project_id": project_id,
            "title": "IUR Smoke Scene",
            "overarching_prompt": "campsite",
            "style_preset": "cinematic",
        },
    )
    if not isinstance(scene, dict) or not isinstance(scene.get("id"), str):
        raise RuntimeError("Scene create response is invalid")
    scene_id = scene["id"]

    print("[3/3] Loading initial SceneSpec")
    _ = client.call("GET", f"/scenes/{scene_id}/spec")

    if scenario == SCENARIO_DIRECTED_3_LAYER:
        scene_spec = _build_scene_spec_directed_3_layer(scene_id=scene_id, title="Directed 3-Layer")
        result = _run_directed_3_layer_flow(
            client,
            scene_id,
            scene_spec,
            process_jobs=process_jobs,
            max_worker_iterations=max_worker_iterations,
            wireframe_variants=wireframe_variants,
        )
    else:
        scene_spec = _build_scene_spec_mvp(scene_id=scene_id, title="IUR Smoke Scene")
        result = _run_mvp_flow(
            client,
            scene_id,
            scene_spec,
            process_jobs=process_jobs,
            max_worker_iterations=max_worker_iterations,
        )

    scenes = client.call("GET", f"/scenes?project_id={project_id}")
    if not isinstance(scenes, list) or not any(
        isinstance(item, dict) and item.get("id") == scene_id for item in scenes
    ):
        raise RuntimeError("Scene missing from project scene listing")

    print(f"IUR smoke flow completed successfully ({scenario})")
    print(
        json.dumps(
            {
                "scenario": scenario,
                "project_id": project_id,
                "scene_id": scene_id,
                **result,
            },
            indent=2,
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Run IUR smoke flow against the API")
    parser.add_argument("--base-url", default="http://localhost:8000", help="API base URL")
    parser.add_argument(
        "--process-jobs",
        action="store_true",
        help="Process queued jobs directly via worker and verify resulting artifacts",
    )
    parser.add_argument(
        "--max-worker-iterations",
        default=16,
        type=int,
        help="Maximum number of worker job processing iterations when --process-jobs is used",
    )
    parser.add_argument(
        "--scenario",
        default=SCENARIO_MVP,
        choices=[SCENARIO_MVP, SCENARIO_DIRECTED_3_LAYER],
        help="Smoke flow scenario to execute",
    )
    parser.add_argument(
        "--wireframe-variants",
        default=3,
        type=int,
        help="Per-object wireframe variants for directed-3-layer scenario",
    )
    args = parser.parse_args()

    try:
        run(
            args.base_url,
            process_jobs=args.process_jobs,
            max_worker_iterations=max(1, args.max_worker_iterations),
            scenario=args.scenario,
            wireframe_variants=max(1, args.wireframe_variants),
        )
    except Exception as exc:
        print(f"IUR smoke failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
