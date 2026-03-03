import argparse
from datetime import UTC
from datetime import datetime
import time

from sqlalchemy import asc
from sqlalchemy import desc
from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.db import models as db_models
from apps.api.db.session import get_session_local
from apps.api.services.artifact_store import LocalArtifactStore
from apps.worker.fake_adapters import render_placeholder_png


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


def _persist_artifact(db: Session, job: db_models.Job, png_bytes: bytes, subtype: str) -> str:
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
        width=512,
        height=512,
        format="png",
        metadata_json={"adapter": "fake_generator_v1", "job_id": job.id},
    )
    db.add(artifact)
    return artifact.id


def process_one_job() -> bool:
    session_local = get_session_local()
    db = session_local()
    try:
        job = _claim_next_job(db)
        if job is None:
            print("worker: no queued jobs")
            return False

        _append_job_log(job, f"Processing job {job.id} ({job.job_type})")

        render_result = render_placeholder_png(job_type=job.job_type, scene_id=job.scene_id, job_id=job.id)
        artifact_id = _persist_artifact(
            db=db,
            job=job,
            png_bytes=render_result.png_bytes,
            subtype=render_result.subtype,
        )

        job.status = "SUCCEEDED"
        job.finished_at = datetime.now(UTC)
        job.output_artifact_ids = [artifact_id]
        _append_job_log(job, f"Generated placeholder artifact {artifact_id}")
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
