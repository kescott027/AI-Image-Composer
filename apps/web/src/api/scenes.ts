import type { SceneSpec } from "@ai-image-composer/shared";

import { parseErrorMessage } from "./http";

export interface SceneRead {
  id: string;
  project_id: string;
  title: string;
  overarching_prompt: string;
  style_preset: string;
  seed_policy: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SceneVersionRead {
  id: string;
  scene_id: string;
  version_number: number;
  created_at?: string | null;
}

export interface SceneVersionCreateResponse {
  version: SceneVersionRead;
  scene_spec: SceneSpec;
}

export interface RelationConflictRead {
  conflict_type: string;
  message: string;
  relation_ids: string[];
  suggestions: string[];
}

export interface CreateSceneRequest {
  project_id: string;
  title: string;
  overarching_prompt?: string;
  style_preset?: string;
  seed_policy?: string;
}

export async function listScenes(projectId?: string): Promise<SceneRead[]> {
  const query = new URLSearchParams();
  if (projectId) {
    query.set("project_id", projectId);
  }
  const suffix = query.toString();
  const response = await fetch(`/api/scenes${suffix ? `?${suffix}` : ""}`);
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Failed to load scenes"));
  }
  return (await response.json()) as SceneRead[];
}

export async function createScene(payload: CreateSceneRequest): Promise<SceneRead> {
  const response = await fetch("/api/scenes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Failed to create scene"));
  }
  return (await response.json()) as SceneRead;
}

export async function getSceneSpec(sceneId: string): Promise<SceneSpec> {
  const response = await fetch(`/api/scenes/${sceneId}/spec`);
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Failed to load scene spec"));
  }
  return (await response.json()) as SceneSpec;
}

export async function upsertSceneSpec(sceneId: string, sceneSpec: SceneSpec): Promise<SceneSpec> {
  const response = await fetch(`/api/scenes/${sceneId}/spec`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(sceneSpec),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Failed to save scene spec"));
  }
  return (await response.json()) as SceneSpec;
}

export async function listSceneVersions(sceneId: string): Promise<SceneVersionRead[]> {
  const response = await fetch(`/api/scenes/${sceneId}/versions`);
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Failed to load scene versions"));
  }
  return (await response.json()) as SceneVersionRead[];
}

export async function getSceneVersion(sceneId: string, versionNumber: number): Promise<SceneSpec> {
  const response = await fetch(`/api/scenes/${sceneId}/versions/${versionNumber}`);
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Failed to load scene version"));
  }
  return (await response.json()) as SceneSpec;
}

export async function createSceneVersion(
  sceneId: string,
  sceneSpec?: SceneSpec,
): Promise<SceneVersionCreateResponse> {
  const response = await fetch(`/api/scenes/${sceneId}/versions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(sceneSpec ?? null),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Failed to save scene version"));
  }
  return (await response.json()) as SceneVersionCreateResponse;
}

export async function detectRelationConflicts(
  sceneId: string,
  sceneSpec?: SceneSpec,
): Promise<RelationConflictRead[]> {
  const response = await fetch(`/api/scenes/${sceneId}/relation-conflicts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(sceneSpec ?? null),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Failed to detect relation conflicts"));
  }
  return (await response.json()) as RelationConflictRead[];
}
