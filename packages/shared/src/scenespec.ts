export const SCENE_SPEC_SCHEMA_VERSION = "0.1.0";

export type JobType =
  | "SKETCH"
  | "OBJECT_RENDER"
  | "FINAL_COMPOSITE"
  | "ZONE_RENDER"
  | "TILE_RENDER"
  | "REFINE";

export interface SceneSpec {
  schema_version: string;
  scene: {
    id: string;
    title: string;
    overarching_prompt: string;
    negative_prompt?: string;
    style_preset?: string;
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
      width: number;
      height: number;
      rotation_deg: number;
    };
  }>;
  relations: Array<{
    id: string;
    subject_object_id: string;
    predicate: string;
    object_object_id: string;
    strength: number;
    notes?: string;
  }>;
  artifacts: Array<{
    id: string;
    type: string;
    uri: string;
    format: string;
    width: number;
    height: number;
  }>;
  jobs: Array<{
    id: string;
    type: JobType;
    status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  }>;
}

export function createEmptySceneSpec(sceneId: string, title: string): SceneSpec {
  return {
    schema_version: SCENE_SPEC_SCHEMA_VERSION,
    scene: {
      id: sceneId,
      title,
      overarching_prompt: "",
      negative_prompt: "",
      style_preset: "default"
    },
    layers: [],
    objects: [],
    relations: [],
    artifacts: [],
    jobs: []
  };
}
