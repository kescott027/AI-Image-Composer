from enum import Enum

from pydantic import BaseModel, Field


class JobType(str, Enum):
    SKETCH = "SKETCH"
    OBJECT_RENDER = "OBJECT_RENDER"
    FINAL_COMPOSITE = "FINAL_COMPOSITE"
    ZONE_RENDER = "ZONE_RENDER"
    TILE_RENDER = "TILE_RENDER"
    REFINE = "REFINE"


class JobStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    CANCELED = "CANCELED"


class JobCreate(BaseModel):
    scene_id: str
    job_type: JobType
    priority: int = Field(default=0, ge=0, le=100)
    input: dict[str, object] = Field(default_factory=dict)


class JobRead(BaseModel):
    id: str
    scene_id: str
    job_type: JobType
    status: JobStatus
    priority: int
    input_hash: str | None = None
    input: dict[str, object] = Field(default_factory=dict)
    output_artifact_ids: list[str] = Field(default_factory=list)
    logs: list[str] = Field(default_factory=list)
    error: str | None = None
    started_at: str | None = None
    finished_at: str | None = None
    created_at: str | None = None
