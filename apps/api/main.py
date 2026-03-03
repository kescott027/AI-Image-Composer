from fastapi import FastAPI
from fastapi import File
from fastapi import Form
from fastapi import HTTPException
from fastapi import UploadFile
from fastapi.responses import FileResponse

from apps.api.models.artifact_store import ArtifactRecord
from apps.api.models.scenespec import SceneSpec
from apps.api.services.artifact_store import LocalArtifactStore
from apps.api.store import scene_spec_store

app = FastAPI(title="AI Image Composer API", version="0.1.0")
artifact_store = LocalArtifactStore.from_env()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "api"}


@app.put("/scenes/{scene_id}/spec", response_model=SceneSpec, tags=["scenes"])
def upsert_scene_spec(scene_id: str, scene_spec: SceneSpec) -> SceneSpec:
    if scene_spec.scene.id != scene_id:
        raise HTTPException(
            status_code=400,
            detail="scene_id in path must match scene.id in payload",
        )

    return scene_spec_store.upsert(scene_id=scene_id, spec=scene_spec)


@app.get("/scenes/{scene_id}/spec", response_model=SceneSpec, tags=["scenes"])
def get_scene_spec(scene_id: str) -> SceneSpec:
    scene_spec = scene_spec_store.get(scene_id)
    if scene_spec is None:
        raise HTTPException(status_code=404, detail="SceneSpec not found")
    return scene_spec


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
