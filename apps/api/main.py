from datetime import UTC
from datetime import datetime
from uuid import uuid4

from fastapi import Body
from fastapi import Depends
from fastapi import FastAPI
from fastapi import File
from fastapi import Form
from fastapi import HTTPException
from fastapi import Query
from fastapi import UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import desc
from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.db import models as db_models
from apps.api.dependencies import get_db_session
from apps.api.models.artifact_store import ArtifactRecord
from apps.api.models.crud import ProjectCreate
from apps.api.models.crud import ProjectRead
from apps.api.models.crud import SceneCreate
from apps.api.models.crud import SceneRead
from apps.api.models.crud import SceneVersionCreateResponse
from apps.api.models.crud import SceneVersionRead
from apps.api.models.scenespec import SceneSpec
from apps.api.services.artifact_store import LocalArtifactStore

app = FastAPI(title="AI Image Composer API", version="0.1.0")
artifact_store = LocalArtifactStore.from_env()


def _generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(UTC).isoformat()


def _project_read(project: db_models.Project) -> ProjectRead:
    return ProjectRead(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=_iso(project.created_at),
    )


def _scene_read(scene: db_models.Scene) -> SceneRead:
    return SceneRead(
        id=scene.id,
        project_id=scene.project_id,
        title=scene.title,
        overarching_prompt=scene.overarching_prompt,
        style_preset=scene.style_preset,
        seed_policy=scene.seed_policy,
        created_at=_iso(scene.created_at),
        updated_at=_iso(scene.updated_at),
    )


def _scene_version_read(scene_version: db_models.SceneVersion) -> SceneVersionRead:
    return SceneVersionRead(
        id=scene_version.id,
        scene_id=scene_version.scene_id,
        version_number=scene_version.version_number,
        created_at=_iso(scene_version.created_at),
    )


def _get_scene_or_404(db: Session, scene_id: str) -> db_models.Scene:
    scene = db.get(db_models.Scene, scene_id)
    if scene is None:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene


def _get_latest_scene_version(db: Session, scene_id: str) -> db_models.SceneVersion | None:
    stmt = (
        select(db_models.SceneVersion)
        .where(db_models.SceneVersion.scene_id == scene_id)
        .order_by(desc(db_models.SceneVersion.version_number))
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


def _next_version_number(db: Session, scene_id: str) -> int:
    latest = _get_latest_scene_version(db, scene_id)
    if latest is None:
        return 1
    return latest.version_number + 1


def _store_scene_version(db: Session, scene_id: str, payload: dict) -> db_models.SceneVersion:
    version_number = _next_version_number(db, scene_id)
    payload.setdefault("history", {})
    payload["history"]["scene_version"] = version_number

    scene_version = db_models.SceneVersion(
        id=_generate_id("sv"),
        scene_id=scene_id,
        version_number=version_number,
        scene_spec_json=payload,
    )
    db.add(scene_version)
    return scene_version


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "api"}


@app.post("/projects", response_model=ProjectRead, tags=["projects"])
def create_project(payload: ProjectCreate, db: Session = Depends(get_db_session)) -> ProjectRead:
    project = db_models.Project(
        id=_generate_id("proj"),
        name=payload.name,
        description=payload.description,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_read(project)


@app.get("/projects", response_model=list[ProjectRead], tags=["projects"])
def list_projects(db: Session = Depends(get_db_session)) -> list[ProjectRead]:
    stmt = select(db_models.Project).order_by(desc(db_models.Project.created_at))
    projects = db.execute(stmt).scalars().all()
    return [_project_read(project) for project in projects]


@app.post("/scenes", response_model=SceneRead, tags=["scenes"])
def create_scene(payload: SceneCreate, db: Session = Depends(get_db_session)) -> SceneRead:
    project = db.get(db_models.Project, payload.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    scene = db_models.Scene(
        id=_generate_id("scene"),
        project_id=payload.project_id,
        title=payload.title,
        overarching_prompt=payload.overarching_prompt,
        style_preset=payload.style_preset,
        seed_policy=payload.seed_policy,
    )
    db.add(scene)
    db.commit()
    db.refresh(scene)
    return _scene_read(scene)


@app.get("/scenes", response_model=list[SceneRead], tags=["scenes"])
def list_scenes(
    project_id: str | None = Query(default=None),
    db: Session = Depends(get_db_session),
) -> list[SceneRead]:
    stmt = select(db_models.Scene)
    if project_id is not None:
        stmt = stmt.where(db_models.Scene.project_id == project_id)
    stmt = stmt.order_by(desc(db_models.Scene.updated_at))

    scenes = db.execute(stmt).scalars().all()
    return [_scene_read(scene) for scene in scenes]


@app.get("/scenes/{scene_id}", response_model=SceneRead, tags=["scenes"])
def get_scene(scene_id: str, db: Session = Depends(get_db_session)) -> SceneRead:
    scene = _get_scene_or_404(db, scene_id)
    return _scene_read(scene)


@app.put("/scenes/{scene_id}/spec", response_model=SceneSpec, tags=["scenes"])
def upsert_scene_spec(
    scene_id: str,
    scene_spec: SceneSpec,
    db: Session = Depends(get_db_session),
) -> SceneSpec:
    if scene_spec.scene.id != scene_id:
        raise HTTPException(
            status_code=400,
            detail="scene_id in path must match scene.id in payload",
        )

    scene = _get_scene_or_404(db, scene_id)

    payload = scene_spec.model_dump(mode="json")
    payload["scene"]["updated_at"] = datetime.now(UTC).isoformat()

    scene.overarching_prompt = payload["scene"].get("overarching_prompt", "")
    scene.style_preset = payload["scene"].get("style_preset", "default")

    _store_scene_version(db=db, scene_id=scene_id, payload=payload)
    db.commit()

    return SceneSpec.model_validate(payload)


@app.get("/scenes/{scene_id}/spec", response_model=SceneSpec, tags=["scenes"])
def get_scene_spec(scene_id: str, db: Session = Depends(get_db_session)) -> SceneSpec:
    _get_scene_or_404(db, scene_id)

    scene_version = _get_latest_scene_version(db, scene_id)
    if scene_version is None:
        raise HTTPException(status_code=404, detail="SceneSpec not found")

    return SceneSpec.model_validate(scene_version.scene_spec_json)


@app.post("/scenes/{scene_id}/versions", response_model=SceneVersionCreateResponse, tags=["scenes"])
def create_scene_version(
    scene_id: str,
    scene_spec: SceneSpec | None = Body(default=None),
    db: Session = Depends(get_db_session),
) -> SceneVersionCreateResponse:
    _get_scene_or_404(db, scene_id)

    if scene_spec is not None and scene_spec.scene.id != scene_id:
        raise HTTPException(
            status_code=400,
            detail="scene_id in path must match scene.id in payload",
        )

    if scene_spec is None:
        latest = _get_latest_scene_version(db, scene_id)
        if latest is None:
            raise HTTPException(status_code=404, detail="No SceneSpec exists to version")
        payload = latest.scene_spec_json
    else:
        payload = scene_spec.model_dump(mode="json")
        payload["scene"]["updated_at"] = datetime.now(UTC).isoformat()

    version = _store_scene_version(db=db, scene_id=scene_id, payload=payload)
    db.commit()
    db.refresh(version)

    return SceneVersionCreateResponse(
        version=_scene_version_read(version),
        scene_spec=SceneSpec.model_validate(payload),
    )


@app.get("/scenes/{scene_id}/versions", response_model=list[SceneVersionRead], tags=["scenes"])
def list_scene_versions(scene_id: str, db: Session = Depends(get_db_session)) -> list[SceneVersionRead]:
    _get_scene_or_404(db, scene_id)

    stmt = (
        select(db_models.SceneVersion)
        .where(db_models.SceneVersion.scene_id == scene_id)
        .order_by(desc(db_models.SceneVersion.version_number))
    )
    versions = db.execute(stmt).scalars().all()
    return [_scene_version_read(version) for version in versions]


@app.get(
    "/scenes/{scene_id}/versions/{version_number}",
    response_model=SceneSpec,
    tags=["scenes"],
)
def get_scene_version(
    scene_id: str,
    version_number: int,
    db: Session = Depends(get_db_session),
) -> SceneSpec:
    _get_scene_or_404(db, scene_id)

    stmt = select(db_models.SceneVersion).where(
        db_models.SceneVersion.scene_id == scene_id,
        db_models.SceneVersion.version_number == version_number,
    )
    version = db.execute(stmt).scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Scene version not found")

    return SceneSpec.model_validate(version.scene_spec_json)


@app.post("/artifacts/upload", response_model=ArtifactRecord, tags=["artifacts"])
async def upload_artifact(
    file: UploadFile = File(...),
    scene_id: str | None = Form(default=None),
    artifact_type: str = Form(default="IMAGE"),
    subtype: str | None = Form(default=None),
) -> ArtifactRecord:
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    return artifact_store.create(
        data=payload,
        filename=file.filename,
        content_type=file.content_type,
        scene_id=scene_id,
        artifact_type=artifact_type,
        subtype=subtype,
    )


@app.get("/artifacts/{artifact_id}/meta", response_model=ArtifactRecord, tags=["artifacts"])
def get_artifact_metadata(artifact_id: str) -> ArtifactRecord:
    metadata = artifact_store.get_metadata(artifact_id)
    if metadata is None:
        raise HTTPException(status_code=404, detail="Artifact metadata not found")
    return metadata


@app.get("/artifacts/{artifact_id}", tags=["artifacts"])
def get_artifact_file(artifact_id: str) -> FileResponse:
    stored_artifact = artifact_store.get(artifact_id)
    if stored_artifact is None:
        raise HTTPException(status_code=404, detail="Artifact not found")

    return FileResponse(
        path=stored_artifact.file_path,
        media_type=stored_artifact.metadata.content_type,
        filename=stored_artifact.metadata.filename,
    )
