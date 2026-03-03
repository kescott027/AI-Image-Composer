from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from apps.api.db.base import Base
from apps.api.db import models as db_models
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


def test_process_one_job_updates_status(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as session:
        scene_id = _seed_scene(session)
        job = db_models.Job(
            id="job_test",
            scene_id=scene_id,
            job_type="SKETCH",
            status="QUEUED",
            priority=0,
            input_json={},
            output_artifact_ids=[],
            logs_json=[],
        )
        session.add(job)
        session.commit()

    monkeypatch.setattr(worker, "get_session_local", lambda: SessionLocal)

    processed = worker.process_one_job()
    assert processed is True

    with SessionLocal() as session:
        updated = session.get(db_models.Job, "job_test")
        assert updated is not None
        assert updated.status == "SUCCEEDED"
        assert updated.started_at is not None
        assert updated.finished_at is not None
        assert len(updated.logs_json) >= 2

    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_process_one_job_when_queue_is_empty(monkeypatch) -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    monkeypatch.setattr(worker, "get_session_local", lambda: SessionLocal)

    processed = worker.process_one_job()
    assert processed is False

    Base.metadata.drop_all(bind=engine)
    engine.dispose()
