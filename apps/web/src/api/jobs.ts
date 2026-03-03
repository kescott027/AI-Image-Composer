import type { JobType, SceneSpec } from "@ai-image-composer/shared";
import { parseErrorMessage } from "./http";

export type SupportedJobType = Extract<
  JobType,
  "SKETCH" | "OBJECT_RENDER" | "FINAL_COMPOSITE" | "ZONE_RENDER" | "REFINE"
>;
export type JobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";

export interface JobRead {
  id: string;
  scene_id: string;
  job_type: JobType;
  status: JobStatus;
  priority: number;
  input_hash?: string | null;
  input: Record<string, unknown>;
  output_artifact_ids: string[];
  logs: string[];
  error?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at?: string | null;
}

interface CreateJobRequest {
  scene_id: string;
  job_type: SupportedJobType;
  priority?: number;
  input?: Record<string, unknown>;
}

interface ListJobsRequest {
  sceneId?: string;
  status?: JobStatus;
}

export async function createJob(request: CreateJobRequest): Promise<JobRead> {
  const response = await fetch("/api/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      scene_id: request.scene_id,
      job_type: request.job_type,
      priority: request.priority ?? 0,
      input: request.input ?? {},
    }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, `Failed to queue ${request.job_type} job`));
  }

  return (await response.json()) as JobRead;
}

export async function listJobs(request: ListJobsRequest): Promise<JobRead[]> {
  const query = new URLSearchParams();
  if (request.sceneId) {
    query.set("scene_id", request.sceneId);
  }
  if (request.status) {
    query.set("status", request.status);
  }
  const suffix = query.toString();
  const response = await fetch(`/api/jobs${suffix ? `?${suffix}` : ""}`);

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Failed to load jobs"));
  }

  return (await response.json()) as JobRead[];
}

export function buildGenerationInput(
  sceneSpec: SceneSpec,
  options?: {
    targetObjectId?: string;
    targetZoneId?: string;
    sourceArtifactId?: string;
    wireframeArtifactId?: string;
    generationMode?: "OBJECT" | "BLOCKING";
  },
): Record<string, unknown> {
  return {
    scene_spec: sceneSpec,
    target_object_id: options?.targetObjectId,
    target_zone_id: options?.targetZoneId,
    source_artifact_id: options?.sourceArtifactId,
    wireframe_artifact_id: options?.wireframeArtifactId,
    generation_mode: options?.generationMode,
    requested_from: "web_editor",
    requested_at: new Date().toISOString(),
  };
}
