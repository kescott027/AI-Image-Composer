from collections.abc import Generator

import apps.api.main as api_main
from apps.api.db.base import Base
from apps.api.dependencies import get_db_session
from apps.api.services.artifact_store import LocalArtifactStore
from apps.worker import worker
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


def test_scene_to_render_happy_path(tmp_path, monkeypatch) -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    artifact_store = LocalArtifactStore(tmp_path / "artifacts")
    previous_artifact_store = api_main.artifact_store
    api_main.artifact_store = artifact_store

    def override_get_db() -> Generator[Session, None, None]:
        db = session_local()
        try:
            yield db
        finally:
            db.close()

    api_main.app.dependency_overrides[get_db_session] = override_get_db
    monkeypatch.setattr(worker, "get_session_local", lambda: session_local)
    monkeypatch.setattr(worker, "get_artifact_store", lambda: artifact_store)

    try:
        with TestClient(api_main.app) as client:
            project = client.post("/projects", json={"name": "Happy Path Project"})
            assert project.status_code == 200
            project_id = project.json()["id"]

            scene = client.post(
                "/scenes",
                json={
                    "project_id": project_id,
                    "title": "Happy Path Scene",
                    "overarching_prompt": "cinematic campsite at dawn",
                    "style_preset": "cinematic",
                },
            )
            assert scene.status_code == 200
            scene_id = scene.json()["id"]

            spec_response = client.get(f"/scenes/{scene_id}/spec")
            assert spec_response.status_code == 200
            spec = spec_response.json()
            object_layer_id = next(
                layer["id"] for layer in spec["layers"] if layer["type"] == "OBJECT"
            )
            spec["objects"] = [
                {
                    "id": "obj_tent",
                    "layer_id": object_layer_id,
                    "name": "Tent",
                    "kind": "prop",
                    "prompt": "detailed canvas expedition tent",
                    "negative_prompt": "blur, low detail",
                    "transform": {
                        "x": 160,
                        "y": 220,
                        "scale_x": 1,
                        "scale_y": 1,
                        "rotation_deg": 0,
                        "z_index": 0,
                        "anchor": "top_left",
                        "width": 180,
                        "height": 130,
                    },
                },
                {
                    "id": "obj_fire",
                    "layer_id": object_layer_id,
                    "name": "Campfire",
                    "kind": "prop",
                    "prompt": "small campfire with glowing embers",
                    "negative_prompt": "smoke artifacts",
                    "transform": {
                        "x": 390,
                        "y": 300,
                        "scale_x": 1,
                        "scale_y": 1,
                        "rotation_deg": 0,
                        "z_index": 1,
                        "anchor": "top_left",
                        "width": 120,
                        "height": 90,
                    },
                },
            ]
            spec["relations"] = [
                {
                    "id": "rel_fire_near_tent",
                    "subject_object_id": "obj_fire",
                    "predicate": "NEAR",
                    "object_object_id": "obj_tent",
                    "strength": 1.0,
                    "notes": "",
                }
            ]

            save_spec = client.put(f"/scenes/{scene_id}/spec", json=spec)
            assert save_spec.status_code == 200

            queued_jobs: list[tuple[str, str]] = []
            for job_type, target_object_id in [
                ("SKETCH", "obj_tent"),
                ("OBJECT_RENDER", "obj_fire"),
                ("FINAL_COMPOSITE", None),
            ]:
                input_payload: dict[str, object] = {"scene_spec": spec}
                if target_object_id is not None:
                    input_payload["target_object_id"] = target_object_id
                response = client.post(
                    "/jobs",
                    json={
                        "scene_id": scene_id,
                        "job_type": job_type,
                        "input": input_payload,
                    },
                )
                assert response.status_code == 200
                queued_jobs.append((job_type, response.json()["id"]))

            processed_count = 0
            for _ in range(12):
                if not worker.process_one_job():
                    break
                processed_count += 1
            assert processed_count >= 3

            jobs_response = client.get("/jobs", params={"scene_id": scene_id})
            assert jobs_response.status_code == 200
            jobs_by_id = {job["id"]: job for job in jobs_response.json()}

            for job_type, job_id in queued_jobs:
                assert jobs_by_id[job_id]["status"] == "SUCCEEDED"
                assert len(jobs_by_id[job_id]["output_artifact_ids"]) >= 1
                if job_type == "FINAL_COMPOSITE":
                    composite_artifact_id = jobs_by_id[job_id]["output_artifact_ids"][0]

            composite_meta_response = client.get(f"/artifacts/{composite_artifact_id}/meta")
            assert composite_meta_response.status_code == 200
            composite_meta = composite_meta_response.json()
            assert composite_meta["subtype"] == "COMPOSITE"
            assert composite_meta["type"] == "IMAGE"

            composite_file_response = client.get(f"/artifacts/{composite_artifact_id}")
            assert composite_file_response.status_code == 200
            assert composite_file_response.content[:8] == b"\x89PNG\r\n\x1a\n"

            reloaded_spec = client.get(f"/scenes/{scene_id}/spec")
            assert reloaded_spec.status_code == 200
            assert len(reloaded_spec.json()["objects"]) == 2
            assert len(reloaded_spec.json()["relations"]) == 1
    finally:
        api_main.app.dependency_overrides.pop(get_db_session, None)
        api_main.artifact_store = previous_artifact_store
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
