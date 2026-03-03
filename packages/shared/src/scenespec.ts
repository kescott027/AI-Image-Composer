export const SCENE_SPEC_SCHEMA_VERSION = "0.1.0";

export type JobType =
  | "SKETCH"
  | "OBJECT_RENDER"
  | "FINAL_COMPOSITE"
  | "ZONE_RENDER"
  | "TILE_RENDER"
  | "REFINE";

export type JobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";

export type RelationPredicate =
  | "FACES"
  | "LEFT_OF"
  | "ABOVE"
  | "NEAR"
  | "RIGHT_OF"
  | "BELOW"
  | "IN_FRONT_OF"
  | "BEHIND"
  | "LOOKING_AT"
  | "HOLDING"
  | "SITTING_ON"
  | "ATTACHED_TO";

export interface SceneSpec {
  schema_version: string;
  scene: {
    id: string;
    title: string;
    overarching_prompt: string;
    negative_prompt?: string;
    style_preset?: string;
    created_at?: string;
    updated_at?: string;
  };
  layers: Array<{
    id: string;
    type: "BACKGROUND" | "OBJECT" | "MASK" | "COMPOSITE" | "ZONE";
    name: string;
    order: number;
    visible: boolean;
    locked: boolean;
    metadata?: Record<string, unknown>;
  }>;
  objects: Array<{
    id: string;
    layer_id: string;
    name: string;
    kind: string;
    prompt: string;
    negative_prompt?: string;
    transform?: {
      x: number;
      y: number;
      scale_x: number;
      scale_y: number;
      rotation_deg: number;
      z_index: number;
      anchor: "center" | "top_left";
      width: number;
      height: number;
    };
    wireframe?: {
      artifact_id: string;
      mask_artifact_id?: string;
      version?: number;
    };
    render?: {
      artifact_id: string;
      mask_artifact_id?: string;
      version?: number;
    };
    status?: "DRAFT" | "WIREFRAME_ONLY" | "RENDERED" | "LOCKED";
    metadata?: Record<string, unknown>;
  }>;
  relations: Array<{
    id: string;
    subject_object_id: string;
    predicate: RelationPredicate | string;
    object_object_id: string;
    strength: number;
    notes?: string;
  }>;
  artifacts: Array<{
    id: string;
    type: string;
    subtype?: string;
    uri: string;
    format: string;
    width: number;
    height: number;
    created_at?: string;
    metadata?: Record<string, unknown>;
  }>;
  jobs: Array<{
    id: string;
    type: JobType;
    status: JobStatus;
    created_at?: string;
    started_at?: string;
    finished_at?: string;
    input_hash?: string;
    input?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    error?: string;
    logs?: string[];
  }>;
  zones: Array<{
    id: string;
    name: string;
    selection_mode?: "AUTO" | "MANUAL";
    shape: {
      type: "rect" | "lasso";
      x: number;
      y: number;
      width: number;
      height: number;
      points?: Array<{ x: number; y: number }>;
    };
    included_object_ids: string[];
    guidance_prompt?: string;
    negative_prompt?: string;
  }>;
  constraints: Array<{
    id: string;
    scope: {
      type: string;
      relation_id?: string;
      object_id?: string;
      zone_id?: string;
    };
    rule: "HARD" | "SOFT";
    weight: number;
    message: string;
  }>;
  settings: {
    units: string;
    canvas: {
      width: number;
      height: number;
      background_color: string;
    };
    defaults: {
      seed_policy: string;
      sampler: string;
      steps: number;
      cfg_scale: number;
      refine_strength: number;
      palette_preset: string;
      lighting_profile: string;
      harmonization_strength: number;
    };
    models: {
      sketch_adapter: string;
      object_render_adapter: string;
      composite_adapter: string;
      zone_adapter: string;
    };
  };
  history: {
    scene_version: number;
    notes?: string;
  };
}

export function createEmptySceneSpec(sceneId: string, title: string): SceneSpec {
  return {
    schema_version: SCENE_SPEC_SCHEMA_VERSION,
    scene: {
      id: sceneId,
      title,
      overarching_prompt: "",
      negative_prompt: "",
      style_preset: "default",
    },
    layers: [],
    objects: [],
    relations: [],
    artifacts: [],
    jobs: [],
    zones: [],
    constraints: [],
    settings: {
      units: "px",
      canvas: {
        width: 820,
        height: 520,
        background_color: "transparent",
      },
      defaults: {
        seed_policy: "per_job",
        sampler: "default",
        steps: 30,
        cfg_scale: 7,
        refine_strength: 0.25,
        palette_preset: "balanced_warm",
        lighting_profile: "soft_indoor",
        harmonization_strength: 0.6,
      },
      models: {
        sketch_adapter: "fake_sketch_v1",
        object_render_adapter: "fake_object_v1",
        composite_adapter: "simple_alpha_v1",
        zone_adapter: "simple_zone_v1",
      },
    },
    history: {
      scene_version: 0,
      notes: "",
    },
  };
}
