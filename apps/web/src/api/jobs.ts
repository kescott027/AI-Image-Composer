import type { JobType, SceneSpec } from "@ai-image-composer/shared";

export type SupportedJobType = Extract<JobType, "SKETCH" | "OBJECT_RENDER" | "FINAL_COMPOSITE">;

export interface JobRead {
  id: string;
  scene_id: string;
  job_type: JobType;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";
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

interface ApiErrorPayload {
  detail?: string;
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
    let detail = `Failed to queue ${request.job_type} job`;
    try {
      const payload = (await response.json()) as ApiErrorPayload;
      if (typeof payload.detail === "string" && payload.detail.length > 0) {
        detail = payload.detail;
      }
    } catch {
      // Ignore JSON parsing errors and return the generic message.
    }
    throw new Error(detail);
  }

  return (await response.json()) as JobRead;
}

export function buildGenerationInput(
  sceneSpec: SceneSpec,
  options?: { targetObjectId?: string },
): Record<string, unknown> {
  return {
    scene_spec: sceneSpec,
    target_object_id: options?.targetObjectId,
    requested_from: "web_editor",
    requested_at: new Date().toISOString(),
  };
}
