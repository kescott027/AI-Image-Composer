from pydantic import BaseModel


class ArtifactRecord(BaseModel):
    id: str
    scene_id: str | None = None
    type: str
    subtype: str | None = None
    uri: str
    filename: str
    format: str
    content_type: str | None = None
    size_bytes: int
    created_at: str
