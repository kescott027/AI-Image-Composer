import json
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from apps.api.db import models as db_models
from apps.api.db.base import Base
from apps.api.services.artifact_store import LocalArtifactStore
from apps.worker import worker


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
            job_type="ZONE_RENDER",
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
