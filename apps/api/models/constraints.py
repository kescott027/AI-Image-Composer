from pydantic import BaseModel


class RelationConflictRead(BaseModel):
    conflict_type: str
    message: str
    relation_ids: list[str]
    suggestions: list[str]
