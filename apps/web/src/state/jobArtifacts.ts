import type { JobRead } from "../api/jobs";

interface SelectedArtifact {
  artifactId: string;
  createdAtMs: number;
}

export interface RecentJobArtifact {
  artifactId: string;
  jobId: string;
  jobType: JobRead["job_type"];
  targetObjectId: string | null;
  createdAt: string | null;
}

function mapLatestArtifactsByObjectId(
  jobs: JobRead[],
  jobType: "SKETCH" | "OBJECT_RENDER",
): Record<string, string> {
  const selected = new Map<string, SelectedArtifact>();

  jobs.forEach((job) => {
    if (job.job_type !== jobType || job.status !== "SUCCEEDED") {
      return;
    }

    const targetObjectId = job.input.target_object_id;
    if (typeof targetObjectId !== "string" || targetObjectId.length === 0) {
      return;
    }

    const artifactId = job.output_artifact_ids[0];
    if (!artifactId) {
      return;
    }

    const createdAtMs = job.created_at ? Date.parse(job.created_at) : 0;
    const existing = selected.get(targetObjectId);
    if (!existing || createdAtMs >= existing.createdAtMs) {
      selected.set(targetObjectId, { artifactId, createdAtMs });
    }
  });

  return Object.fromEntries(
    Array.from(selected.entries()).map(([objectId, value]) => [objectId, value.artifactId]),
  );
}

export function mapLatestSketchArtifactsByObjectId(jobs: JobRead[]): Record<string, string> {
  return mapLatestArtifactsByObjectId(jobs, "SKETCH");
}

export function mapLatestObjectRenderArtifactsByObjectId(jobs: JobRead[]): Record<string, string> {
  return mapLatestArtifactsByObjectId(jobs, "OBJECT_RENDER");
}

export function mapLatestFinalCompositeArtifactId(jobs: JobRead[]): string | null {
  let selectedArtifactId: string | null = null;
  let selectedCreatedAtMs = -1;
  const compositeJobTypes = new Set(["FINAL_COMPOSITE", "ZONE_RENDER", "REFINE"]);

  jobs.forEach((job) => {
    if (!compositeJobTypes.has(job.job_type) || job.status !== "SUCCEEDED") {
      return;
    }

    const artifactId = job.output_artifact_ids[0];
    if (!artifactId) {
      return;
    }

    const createdAtMs = job.created_at ? Date.parse(job.created_at) : 0;
    if (createdAtMs >= selectedCreatedAtMs) {
      selectedArtifactId = artifactId;
      selectedCreatedAtMs = createdAtMs;
    }
  });

  return selectedArtifactId;
}

export function mapRecentSuccessfulArtifacts(jobs: JobRead[], limit = 12): RecentJobArtifact[] {
  const recent: Array<RecentJobArtifact & { createdAtMs: number; artifactIndex: number }> = [];

  jobs.forEach((job) => {
    if (job.status !== "SUCCEEDED" || job.output_artifact_ids.length === 0) {
      return;
    }

    const createdAtMs = job.created_at ? Date.parse(job.created_at) : 0;
    const targetObjectId =
      typeof job.input.target_object_id === "string" && job.input.target_object_id.length > 0
        ? job.input.target_object_id
        : null;

    job.output_artifact_ids.forEach((artifactId, artifactIndex) => {
      if (!artifactId) {
        return;
      }
      recent.push({
        artifactId,
        artifactIndex,
        jobId: job.id,
        jobType: job.job_type,
        targetObjectId,
        createdAt: job.created_at ?? null,
        createdAtMs,
      });
    });
  });

  return recent
    .sort((left, right) => {
      if (right.createdAtMs !== left.createdAtMs) {
        return right.createdAtMs - left.createdAtMs;
      }
      return left.artifactIndex - right.artifactIndex;
    })
    .slice(0, Math.max(0, limit))
    .map((entry) => ({
      artifactId: entry.artifactId,
      jobId: entry.jobId,
      jobType: entry.jobType,
      targetObjectId: entry.targetObjectId,
      createdAt: entry.createdAt,
    }));
}
