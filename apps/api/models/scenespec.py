from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class LayerType(str, Enum):
    BACKGROUND = "BACKGROUND"
    OBJECT = "OBJECT"
    MASK = "MASK"
    COMPOSITE = "COMPOSITE"
    ZONE = "ZONE"


class ObjectStatus(str, Enum):
    DRAFT = "DRAFT"
    WIREFRAME_ONLY = "WIREFRAME_ONLY"
    RENDERED = "RENDERED"
    LOCKED = "LOCKED"


class Predicate(str, Enum):
    FACES = "FACES"
    LOOKING_AT = "LOOKING_AT"
    LEFT_OF = "LEFT_OF"
    RIGHT_OF = "RIGHT_OF"
    ABOVE = "ABOVE"
    BELOW = "BELOW"
    IN_FRONT_OF = "IN_FRONT_OF"
    BEHIND = "BEHIND"
    NEAR = "NEAR"
    HOLDING = "HOLDING"
    SITTING_ON = "SITTING_ON"
    ATTACHED_TO = "ATTACHED_TO"


class ConstraintRule(str, Enum):
    HARD = "HARD"
    SOFT = "SOFT"


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


class ArtifactType(str, Enum):
    IMAGE = "IMAGE"
    MASK = "MASK"
    THUMBNAIL = "THUMBNAIL"
    DEPTH = "DEPTH"
    NORMAL = "NORMAL"
    TILE = "TILE"


class Scene(BaseModel):
    id: str
    title: str
    overarching_prompt: str
    negative_prompt: str | None = ""
    style_preset: str | None = "default"
    created_at: str | None = None
    updated_at: str | None = None


class CanvasSettings(BaseModel):
    width: int = Field(default=1024, ge=1)
    height: int = Field(default=1024, ge=1)
    background_color: str = "transparent"


class DefaultGenerationSettings(BaseModel):
    seed_policy: str = "per_job"
    sampler: str = "default"
    steps: int = Field(default=30, ge=1)
    cfg_scale: float = Field(default=7.0, ge=0)
    refine_strength: float = Field(default=0.25, ge=0, le=1)


class ModelAdapterSettings(BaseModel):
    sketch_adapter: str = "fake_sketch_v1"
    object_render_adapter: str = "fake_object_v1"
    composite_adapter: str = "simple_alpha_v1"
    zone_adapter: str = "simple_zone_v1"


class SceneSettings(BaseModel):
    units: str = "px"
    canvas: CanvasSettings = Field(default_factory=CanvasSettings)
    defaults: DefaultGenerationSettings = Field(default_factory=DefaultGenerationSettings)
    models: ModelAdapterSettings = Field(default_factory=ModelAdapterSettings)


class Layer(BaseModel):
    id: str
    type: LayerType
    name: str
    order: int
    visible: bool = True
    locked: bool = False
    metadata: dict[str, object] = Field(default_factory=dict)


class ObjectTransform(BaseModel):
    x: float = 0
    y: float = 0
    scale_x: float = 1.0
    scale_y: float = 1.0
    rotation_deg: float = 0.0
    z_index: int = 0
    anchor: str = "center"
    width: float = Field(default=120, ge=1)
    height: float = Field(default=84, ge=1)


class ArtifactRef(BaseModel):
    artifact_id: str
    mask_artifact_id: str | None = None
    version: int = 1


class SceneObject(BaseModel):
    id: str
    layer_id: str
    name: str
    kind: str
    prompt: str
    negative_prompt: str | None = ""
    transform: ObjectTransform = Field(default_factory=ObjectTransform)
    wireframe: ArtifactRef | None = None
    render: ArtifactRef | None = None
    status: ObjectStatus = ObjectStatus.DRAFT
    metadata: dict[str, object] = Field(default_factory=dict)


class Relation(BaseModel):
    id: str
    subject_object_id: str
    predicate: Predicate
    object_object_id: str
    strength: float = Field(default=1.0, ge=0, le=1)
    notes: str | None = ""


class ZonePoint(BaseModel):
    x: float
    y: float


class ZoneShape(BaseModel):
    type: Literal["rect", "lasso"] = "rect"
    x: float
    y: float
    width: float = Field(ge=1)
    height: float = Field(ge=1)
    points: list[ZonePoint] = Field(default_factory=list)


class Zone(BaseModel):
    id: str
    name: str
    shape: ZoneShape
    included_object_ids: list[str] = Field(default_factory=list)
    guidance_prompt: str | None = ""
    negative_prompt: str | None = ""


class ConstraintScope(BaseModel):
    type: str
    relation_id: str | None = None
    object_id: str | None = None
    zone_id: str | None = None


class Constraint(BaseModel):
    id: str
    scope: ConstraintScope
    rule: ConstraintRule
    weight: float = Field(default=0.5, ge=0, le=1)
    message: str


class Artifact(BaseModel):
    id: str
    type: ArtifactType
    subtype: str | None = None
    uri: str
    width: int = Field(ge=1)
    height: int = Field(ge=1)
    format: str
    created_at: str | None = None
    metadata: dict[str, object] = Field(default_factory=dict)


class JobInput(BaseModel):
    scene_version: int | None = None
    target_object_id: str | None = None
    target_zone_id: str | None = None
    adapter: str | None = None
    params: dict[str, object] = Field(default_factory=dict)


class JobOutputs(BaseModel):
    primary_artifact_id: str | None = None
    mask_artifact_id: str | None = None


class Job(BaseModel):
    id: str
    type: JobType
    status: JobStatus
    created_at: str | None = None
    started_at: str | None = None
    finished_at: str | None = None
    input_hash: str | None = None
    input: JobInput = Field(default_factory=JobInput)
    outputs: JobOutputs = Field(default_factory=JobOutputs)
    error: str | None = None
    logs: list[str] = Field(default_factory=list)


class History(BaseModel):
    scene_version: int = 1
    notes: str | None = ""


class SceneSpec(BaseModel):
    model_config = ConfigDict(extra="allow")

    schema_version: str = "0.1.0"
    scene: Scene
    layers: list[Layer] = Field(default_factory=list)
    objects: list[SceneObject] = Field(default_factory=list)
    relations: list[Relation] = Field(default_factory=list)
    artifacts: list[Artifact] = Field(default_factory=list)
    jobs: list[Job] = Field(default_factory=list)
    zones: list[Zone] = Field(default_factory=list)
    constraints: list[Constraint] = Field(default_factory=list)
    settings: SceneSettings = Field(default_factory=SceneSettings)
    history: History = Field(default_factory=History)
