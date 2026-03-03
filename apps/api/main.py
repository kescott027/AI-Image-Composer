from fastapi import FastAPI
from fastapi import HTTPException

from apps.api.models.scenespec import SceneSpec
from apps.api.store import scene_spec_store

app = FastAPI(title="AI Image Composer API", version="0.1.0")


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
