import type { JobRead } from "../api/jobs";

interface SelectedArtifact {
  artifactId: string;
  createdAtMs: number;
}

export function mapLatestSketchArtifactsByObjectId(jobs: JobRead[]): Record<string, string> {
  const selected = new Map<string, SelectedArtifact>();

  jobs.forEach((job) => {
    if (job.job_type !== "SKETCH" || job.status !== "SUCCEEDED") {
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
