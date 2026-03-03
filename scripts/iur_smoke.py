#!/usr/bin/env python3
"""Initial Usable Release smoke flow for AI Image Composer.

This script validates the end-to-end MVP API workflow:
1) Create project
2) Create scene
3) Load + update SceneSpec (prompts, objects)
4) Queue sketch + object render + final composite jobs
5) Verify versions and job records are present
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import datetime
from urllib import error, request
from urllib.parse import urlparse


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


def _build_scene_spec(scene_id: str, title: str) -> dict:
    timestamp = datetime.utcnow().isoformat() + "Z"
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


def run(base_url: str) -> None:
    client = ApiClient(base_url=_validated_http_url(base_url))

    print("[1/8] Creating project")
    project = client.call("POST", "/projects", {"name": "IUR Smoke Project"})
    project_id = project["id"]

    print("[2/8] Creating scene")
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
    scene_id = scene["id"]

    print("[3/8] Loading initial SceneSpec")
    _ = client.call("GET", f"/scenes/{scene_id}/spec")

    print("[4/8] Saving SceneSpec with prompts, objects, and relations")
    scene_spec = _build_scene_spec(scene_id=scene_id, title="IUR Smoke Scene")
    saved_spec = client.call("PUT", f"/scenes/{scene_id}/spec", scene_spec)
    if saved_spec["scene"]["id"] != scene_id:
        raise RuntimeError("Saved scene spec does not match requested scene")

    print("[5/8] Saving manual version")
    version = client.call("POST", f"/scenes/{scene_id}/versions", scene_spec)
    if version["version"]["version_number"] < 2:
        raise RuntimeError("Expected scene version number >= 2 after manual save")

    print("[6/8] Queueing sketch + object render jobs")
    client.call(
        "POST",
        "/jobs",
        {
            "scene_id": scene_id,
            "job_type": "SKETCH",
            "input": {"scene_spec": scene_spec, "target_object_id": "obj_tent"},
        },
    )
    client.call(
        "POST",
        "/jobs",
        {
            "scene_id": scene_id,
            "job_type": "OBJECT_RENDER",
            "input": {"scene_spec": scene_spec, "target_object_id": "obj_tent"},
        },
    )

    print("[7/8] Queueing final composite job")
    client.call(
        "POST",
        "/jobs",
        {
            "scene_id": scene_id,
            "job_type": "FINAL_COMPOSITE",
            "input": {"scene_spec": scene_spec},
        },
    )

    print("[8/8] Verifying persistence endpoints")
    versions = client.call("GET", f"/scenes/{scene_id}/versions")
    jobs = client.call("GET", f"/jobs?scene_id={scene_id}")
    scenes = client.call("GET", f"/scenes?project_id={project_id}")

    if len(versions) < 2:
        raise RuntimeError("Expected at least 2 scene versions")
    if len(jobs) < 3:
        raise RuntimeError("Expected at least 3 jobs")
    if not any(item["id"] == scene_id for item in scenes):
        raise RuntimeError("Scene missing from project scene listing")

    print("IUR smoke flow completed successfully")
    print(json.dumps({"project_id": project_id, "scene_id": scene_id, "jobs": len(jobs)}, indent=2))


def main() -> int:
    parser = argparse.ArgumentParser(description="Run IUR smoke flow against the API")
    parser.add_argument("--base-url", default="http://localhost:8000", help="API base URL")
    args = parser.parse_args()

    try:
        run(args.base_url)
    except Exception as exc:
        print(f"IUR smoke failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
