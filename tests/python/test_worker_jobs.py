import json
from pathlib import Path

import pytest
from apps.api.db import models as db_models
from apps.api.db.base import Base
from apps.api.services.artifact_store import LocalArtifactStore
from apps.worker import worker
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def _png_bytes(
    width: int = 64, height: int = 64, color: tuple[int, int, int, int] = (80, 130, 220, 255)
) -> bytes:
    image = Image.new("RGBA", (width, height), color)
    from io import BytesIO

    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def _seed_scene(session) -> str:
    project = db_models.Project(id="proj_test", name="Worker Project", description=None)
    scene = db_models.Scene(
        id="scene_test",
        project_id=project.id,
        title="Worker Scene",
        overarching_prompt="",
        style_preset="default",
        seed_policy="per_job",
    )
    session.add(project)
    session.add(scene)
    session.commit()
    return scene.id


def _db_session_factory():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False})
    session_local = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)
    return engine, session_local


@pytest.mark.parametrize(
    ("job_type", "expected_subtype"),
    [
        ("SKETCH", "WIRE"),
        ("OBJECT_RENDER", "RENDER"),
        ("FINAL_COMPOSITE", "COMPOSITE"),
    ],
)
def test_process_one_job_generates_artifact(
    monkeypatch,
    tmp_path: Path,
    job_type: str,
    expected_subtype: str,
) -> None:
    engine, session_local = _db_session_factory()

    with session_local() as session:
        scene_id = _seed_scene(session)
        job = db_models.Job(
            id=f"job_{job_type.lower()}",
            scene_id=scene_id,
            job_type=job_type,
            status="QUEUED",
            priority=0,
            input_json={},
            output_artifact_ids=[],
            logs_json=[],
        )
        session.add(job)
        session.commit()

    monkeypatch.setattr(worker, "get_session_local", lambda: session_local)
    monkeypatch.setattr(worker, "get_artifact_store", lambda: LocalArtifactStore(tmp_path))

    processed = worker.process_one_job()
    assert processed is True

    with session_local() as session:
        updated = session.get(db_models.Job, f"job_{job_type.lower()}")
        assert updated is not None
        assert updated.status == "SUCCEEDED"
        assert updated.started_at is not None
        assert updated.finished_at is not None
        assert len(updated.output_artifact_ids) == 1

        artifact_id = updated.output_artifact_ids[0]
        artifact = session.get(db_models.Artifact, artifact_id)
        assert artifact is not None
        assert artifact.subtype == expected_subtype
        assert artifact.format == "png"
        assert artifact.uri.startswith("artifact://local/")

    metadata_path = tmp_path / f"{artifact_id}.json"
    assert metadata_path.exists()

    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    png_path = tmp_path / metadata["filename"]
    assert png_path.exists()
    assert png_path.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"

    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_process_one_job_fails_for_unsupported_adapter(monkeypatch, tmp_path: Path) -> None:
    engine, session_local = _db_session_factory()

    with session_local() as session:
        scene_id = _seed_scene(session)
        job = db_models.Job(
            id="job_unsupported",
            scene_id=scene_id,
            job_type="TILE_RENDER",
            status="QUEUED",
            priority=0,
            input_json={},
            output_artifact_ids=[],
            logs_json=[],
        )
        session.add(job)
        session.commit()

    monkeypatch.setattr(worker, "get_session_local", lambda: session_local)
    monkeypatch.setattr(worker, "get_artifact_store", lambda: LocalArtifactStore(tmp_path))

    processed = worker.process_one_job()
    assert processed is False

    with session_local() as session:
        updated = session.get(db_models.Job, "job_unsupported")
        assert updated is not None
        assert updated.status == "FAILED"
        assert updated.error is not None

    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_process_one_job_when_queue_is_empty(monkeypatch, tmp_path: Path) -> None:
    engine, session_local = _db_session_factory()

    monkeypatch.setattr(worker, "get_session_local", lambda: session_local)
    monkeypatch.setattr(worker, "get_artifact_store", lambda: LocalArtifactStore(tmp_path))

    processed = worker.process_one_job()
    assert processed is False

    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_process_one_job_persists_mask_artifact_when_adapter_returns_mask(
    monkeypatch, tmp_path: Path
) -> None:
    engine, session_local = _db_session_factory()

    with session_local() as session:
        scene_id = _seed_scene(session)
        job = db_models.Job(
            id="job_masked",
            scene_id=scene_id,
            job_type="OBJECT_RENDER",
            status="QUEUED",
            priority=0,
            input_json={},
            output_artifact_ids=[],
            logs_json=[],
        )
        session.add(job)
        session.commit()

    class _MaskAdapter:
        def render(self, *, scene_id: str, job_id: str, input_payload: dict[str, object]):
            png_header = b"\x89PNG\r\n\x1a\n"
            return type(
                "Result",
                (),
                {
                    "png_bytes": png_header + b"primary",
                    "width": 64,
                    "height": 64,
                    "subtype": "RENDER",
                    "adapter_name": "test_mask_adapter",
                    "mask_png_bytes": png_header + b"mask",
                    "mask_subtype": "RMASK",
                },
            )()

    monkeypatch.setattr(worker, "get_session_local", lambda: session_local)
    monkeypatch.setattr(worker, "get_artifact_store", lambda: LocalArtifactStore(tmp_path))
    monkeypatch.setattr(worker, "resolve_adapter", lambda _job_type: _MaskAdapter())

    processed = worker.process_one_job()
    assert processed is True

    with session_local() as session:
        updated = session.get(db_models.Job, "job_masked")
        assert updated is not None
        assert updated.status == "SUCCEEDED"
        assert len(updated.output_artifact_ids) == 2

        primary = session.get(db_models.Artifact, updated.output_artifact_ids[0])
        mask = session.get(db_models.Artifact, updated.output_artifact_ids[1])
        assert primary is not None
        assert primary.subtype == "RENDER"
        assert mask is not None
        assert mask.subtype == "RMASK"

    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_process_one_job_zone_render_generates_zone_and_composite_artifacts(
    monkeypatch,
    tmp_path: Path,
) -> None:
    engine, session_local = _db_session_factory()
    artifact_store = LocalArtifactStore(tmp_path)

    with session_local() as session:
        scene_id = _seed_scene(session)
        source = artifact_store.create(
            data=_png_bytes(),
            filename="source.png",
            content_type="image/png",
            scene_id=scene_id,
            artifact_type="IMAGE",
            subtype="RENDER",
        )
        session.add(
            db_models.Artifact(
                id=source.id,
                scene_id=scene_id,
                type="IMAGE",
                subtype="RENDER",
                uri=source.uri,
                width=64,
                height=64,
                format="png",
                metadata_json={},
            )
        )
        session.add(
            db_models.Job(
                id="job_source_render",
                scene_id=scene_id,
                job_type="OBJECT_RENDER",
                status="SUCCEEDED",
                priority=0,
                input_json={"target_object_id": "obj_hero"},
                output_artifact_ids=[source.id],
                logs_json=[],
            )
        )

        scene_spec = {
            "scene": {"id": scene_id, "title": "Zone Scene", "overarching_prompt": ""},
            "layers": [
                {
                    "id": "layer_obj",
                    "type": "OBJECT",
                    "name": "Objects",
                    "order": 1,
                    "visible": True,
                }
            ],
            "objects": [
                {
                    "id": "obj_hero",
                    "layer_id": "layer_obj",
                    "name": "Hero",
                    "kind": "character",
                    "prompt": "hero",
                    "transform": {
                        "x": 120,
                        "y": 80,
                        "scale_x": 1,
                        "scale_y": 1,
                        "rotation_deg": 0,
                        "z_index": 0,
                        "width": 110,
                        "height": 80,
                    },
                }
            ],
            "relations": [],
            "zones": [
                {
                    "id": "zone_1",
                    "name": "Hero Zone",
                    "selection_mode": "MANUAL",
                    "shape": {"type": "rect", "x": 90, "y": 60, "width": 220, "height": 180},
                    "included_object_ids": ["obj_hero"],
                }
            ],
            "settings": {"canvas": {"width": 820, "height": 520}},
        }

        session.add(
            db_models.Job(
                id="job_zone",
                scene_id=scene_id,
                job_type="ZONE_RENDER",
                status="QUEUED",
                priority=0,
                input_json={"scene_spec": scene_spec},
                output_artifact_ids=[],
                logs_json=[],
            )
        )
        session.commit()

    monkeypatch.setattr(worker, "get_session_local", lambda: session_local)
    monkeypatch.setattr(worker, "get_artifact_store", lambda: artifact_store)

    processed = worker.process_one_job()
    assert processed is True

    with session_local() as session:
        updated = session.get(db_models.Job, "job_zone")
        assert updated is not None
        assert updated.status == "SUCCEEDED"
        assert len(updated.output_artifact_ids) == 2

        artifact_subtypes = {
            session.get(db_models.Artifact, artifact_id).subtype
            for artifact_id in updated.output_artifact_ids
            if session.get(db_models.Artifact, artifact_id) is not None
        }
        assert "COMPOSITE" in artifact_subtypes
        assert "ZONE" in artifact_subtypes
        zone_artifact = next(
            (
                session.get(db_models.Artifact, artifact_id)
                for artifact_id in updated.output_artifact_ids
                if session.get(db_models.Artifact, artifact_id) is not None
                and session.get(db_models.Artifact, artifact_id).subtype == "ZONE"
            ),
            None,
        )
        assert zone_artifact is not None
        assert zone_artifact.metadata_json["selection_mode"] == "MANUAL"

    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_process_one_job_refine_generates_refined_artifact(monkeypatch, tmp_path: Path) -> None:
    engine, session_local = _db_session_factory()
    artifact_store = LocalArtifactStore(tmp_path)

    with session_local() as session:
        scene_id = _seed_scene(session)
        source = artifact_store.create(
            data=_png_bytes(120, 90, (140, 120, 200, 255)),
            filename="composite.png",
            content_type="image/png",
            scene_id=scene_id,
            artifact_type="IMAGE",
            subtype="COMPOSITE",
        )
        session.add(
            db_models.Artifact(
                id=source.id,
                scene_id=scene_id,
                type="IMAGE",
                subtype="COMPOSITE",
                uri=source.uri,
                width=120,
                height=90,
                format="png",
                metadata_json={},
            )
        )
        session.add(
            db_models.Job(
                id="job_source_composite",
                scene_id=scene_id,
                job_type="FINAL_COMPOSITE",
                status="SUCCEEDED",
                priority=0,
                input_json={},
                output_artifact_ids=[source.id],
                logs_json=[],
            )
        )
        session.add(
            db_models.Job(
                id="job_refine",
                scene_id=scene_id,
                job_type="REFINE",
                status="QUEUED",
                priority=0,
                input_json={
                    "source_artifact_id": source.id,
                    "scene_spec": {"settings": {"defaults": {"refine_strength": 0.4}}},
                },
                output_artifact_ids=[],
                logs_json=[],
            )
        )
        session.commit()

    monkeypatch.setattr(worker, "get_session_local", lambda: session_local)
    monkeypatch.setattr(worker, "get_artifact_store", lambda: artifact_store)

    processed = worker.process_one_job()
    assert processed is True

    with session_local() as session:
        updated = session.get(db_models.Job, "job_refine")
        assert updated is not None
        assert updated.status == "SUCCEEDED"
        assert len(updated.output_artifact_ids) == 1

        refined_artifact = session.get(db_models.Artifact, updated.output_artifact_ids[0])
        assert refined_artifact is not None
        assert refined_artifact.subtype == "REFINED"
        assert refined_artifact.metadata_json["source_artifact_id"] == source.id
        assert refined_artifact.metadata_json["refine_strength"] == 0.4

    Base.metadata.drop_all(bind=engine)
    engine.dispose()
