import { describe, expect, it } from "vitest";

import type { JobRead } from "../../apps/web/src/api/jobs";
import { mapLatestSketchArtifactsByObjectId } from "../../apps/web/src/state/jobArtifacts";

function createJob(overrides: Partial<JobRead>): JobRead {
  return {
    id: "job_default",
    scene_id: "scene_1",
    job_type: "SKETCH",
    status: "SUCCEEDED",
    priority: 0,
    input: {},
    output_artifact_ids: [],
    logs: [],
    input_hash: null,
    error: null,
    started_at: null,
    finished_at: null,
    created_at: null,
    ...overrides,
  };
}

describe("mapLatestSketchArtifactsByObjectId", () => {
  it("maps latest successful sketch artifact per object", () => {
    const jobs: JobRead[] = [
      createJob({
        id: "job_old",
        input: { target_object_id: "obj_hero" },
        output_artifact_ids: ["art_old"],
        created_at: "2026-03-02T10:00:00Z",
      }),
      createJob({
        id: "job_new",
        input: { target_object_id: "obj_hero" },
        output_artifact_ids: ["art_new"],
        created_at: "2026-03-02T11:00:00Z",
      }),
      createJob({
        id: "job_other",
        input: { target_object_id: "obj_villain" },
        output_artifact_ids: ["art_villain"],
        created_at: "2026-03-02T12:00:00Z",
      }),
    ];

    const map = mapLatestSketchArtifactsByObjectId(jobs);

    expect(map).toEqual({
      obj_hero: "art_new",
      obj_villain: "art_villain",
    });
  });

  it("ignores non-sketch, failed, and unbound jobs", () => {
    const jobs: JobRead[] = [
      createJob({
        id: "job_failed",
        status: "FAILED",
        input: { target_object_id: "obj_1" },
        output_artifact_ids: ["art_failed"],
      }),
      createJob({
        id: "job_other_type",
        job_type: "OBJECT_RENDER",
        input: { target_object_id: "obj_1" },
        output_artifact_ids: ["art_render"],
      }),
      createJob({
        id: "job_no_target",
        input: {},
        output_artifact_ids: ["art_scene"],
      }),
      createJob({
        id: "job_no_output",
        input: { target_object_id: "obj_2" },
        output_artifact_ids: [],
      }),
    ];

    const map = mapLatestSketchArtifactsByObjectId(jobs);

    expect(map).toEqual({});
  });
});
