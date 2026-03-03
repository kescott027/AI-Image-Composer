from apps.api.models.scenespec import SceneSpec
from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class ProjectRead(BaseModel):
    id: str
    name: str
    description: str | None = None
    created_at: str | None = None
    archived_at: str | None = None


class SceneCreate(BaseModel):
    project_id: str
    title: str = Field(min_length=1, max_length=255)
    overarching_prompt: str = ""
    style_preset: str = "default"
    seed_policy: str = "per_job"


class SceneRead(BaseModel):
    id: str
    project_id: str
    title: str
    overarching_prompt: str
    style_preset: str
    seed_policy: str
    created_at: str | None = None
    updated_at: str | None = None


class SceneVersionRead(BaseModel):
    id: str
    scene_id: str
    version_number: int
    created_at: str | None = None


class SceneVersionCreateResponse(BaseModel):
    version: SceneVersionRead
    scene_spec: SceneSpec
