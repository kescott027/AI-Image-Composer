import { describe, expect, it } from "vitest";

import type { JobRead } from "../../apps/web/src/api/jobs";
import {
  mapLatestBlockingSketchArtifactId,
  mapLatestFinalCompositeArtifactId,
  mapLatestObjectRenderArtifactsByObjectId,
  mapLatestSketchArtifactsByObjectId,
  mapRecentSuccessfulArtifacts,
  mapSketchArtifactCandidatesByObjectId,
} from "../../apps/web/src/state/jobArtifacts";

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

describe("mapLatestBlockingSketchArtifactId", () => {
  it("returns latest scene-level sketch artifact", () => {
    const jobs: JobRead[] = [
      createJob({
        id: "job_obj",
        input: { target_object_id: "obj_hero" },
        output_artifact_ids: ["art_obj"],
        created_at: "2026-03-02T09:00:00Z",
      }),
      createJob({
        id: "job_block_old",
        input: {},
        output_artifact_ids: ["art_block_old"],
        created_at: "2026-03-02T10:00:00Z",
      }),
      createJob({
        id: "job_block_new",
        input: {},
        output_artifact_ids: ["art_block_new"],
        created_at: "2026-03-02T11:00:00Z",
      }),
    ];

    expect(mapLatestBlockingSketchArtifactId(jobs)).toBe("art_block_new");
  });

  it("returns null when no scene-level sketch artifacts are present", () => {
    const jobs: JobRead[] = [
      createJob({
        id: "job_obj",
        input: { target_object_id: "obj_hero" },
        output_artifact_ids: ["art_obj"],
      }),
    ];
    expect(mapLatestBlockingSketchArtifactId(jobs)).toBeNull();
  });
});

describe("mapSketchArtifactCandidatesByObjectId", () => {
  it("returns latest candidates per object in descending time order", () => {
    const jobs: JobRead[] = [
      createJob({
        id: "job_1",
        input: { target_object_id: "obj_hero" },
        output_artifact_ids: ["art_1"],
        created_at: "2026-03-02T10:00:00Z",
      }),
      createJob({
        id: "job_2",
        input: { target_object_id: "obj_hero" },
        output_artifact_ids: ["art_2"],
        created_at: "2026-03-02T11:00:00Z",
      }),
      createJob({
        id: "job_3",
        input: { target_object_id: "obj_hero" },
        output_artifact_ids: ["art_3"],
        created_at: "2026-03-02T12:00:00Z",
      }),
      createJob({
        id: "job_other",
        input: { target_object_id: "obj_table" },
        output_artifact_ids: ["art_table"],
        created_at: "2026-03-02T09:00:00Z",
      }),
    ];

    expect(mapSketchArtifactCandidatesByObjectId(jobs, 2)).toEqual({
      obj_hero: ["art_3", "art_2"],
      obj_table: ["art_table"],
    });
  });
});

describe("mapLatestObjectRenderArtifactsByObjectId", () => {
  it("maps latest successful object render artifact per object", () => {
    const jobs: JobRead[] = [
      createJob({
        id: "job_old_render",
        job_type: "OBJECT_RENDER",
        input: { target_object_id: "obj_hero" },
        output_artifact_ids: ["art_render_old"],
        created_at: "2026-03-02T10:00:00Z",
      }),
      createJob({
        id: "job_new_render",
        job_type: "OBJECT_RENDER",
        input: { target_object_id: "obj_hero" },
        output_artifact_ids: ["art_render_new"],
        created_at: "2026-03-02T11:00:00Z",
      }),
      createJob({
        id: "job_sketch",
        job_type: "SKETCH",
        input: { target_object_id: "obj_hero" },
        output_artifact_ids: ["art_sketch"],
        created_at: "2026-03-02T12:00:00Z",
      }),
    ];

    const map = mapLatestObjectRenderArtifactsByObjectId(jobs);

    expect(map).toEqual({
      obj_hero: "art_render_new",
    });
  });

  it("ignores failed and unbound object render jobs", () => {
    const jobs: JobRead[] = [
      createJob({
        id: "job_failed_render",
        job_type: "OBJECT_RENDER",
        status: "FAILED",
        input: { target_object_id: "obj_1" },
        output_artifact_ids: ["art_failed"],
      }),
      createJob({
        id: "job_no_target_render",
        job_type: "OBJECT_RENDER",
        input: {},
        output_artifact_ids: ["art_scene"],
      }),
    ];

    const map = mapLatestObjectRenderArtifactsByObjectId(jobs);

    expect(map).toEqual({});
  });
});

describe("mapLatestFinalCompositeArtifactId", () => {
  it("returns latest successful final composite artifact id", () => {
    const jobs: JobRead[] = [
      createJob({
        id: "job_old_composite",
        job_type: "FINAL_COMPOSITE",
        output_artifact_ids: ["art_comp_old"],
        created_at: "2026-03-02T10:00:00Z",
      }),
      createJob({
        id: "job_new_composite",
        job_type: "FINAL_COMPOSITE",
        output_artifact_ids: ["art_comp_new"],
        created_at: "2026-03-02T11:00:00Z",
      }),
      createJob({
        id: "job_failed_composite",
        job_type: "FINAL_COMPOSITE",
        status: "FAILED",
        output_artifact_ids: ["art_comp_failed"],
        created_at: "2026-03-02T12:00:00Z",
      }),
    ];

    const artifactId = mapLatestFinalCompositeArtifactId(jobs);
    expect(artifactId).toBe("art_comp_new");
  });

  it("returns null when no successful final composite exists", () => {
    const jobs: JobRead[] = [
      createJob({
        id: "job_sketch_only",
        job_type: "SKETCH",
        output_artifact_ids: ["art_sketch"],
      }),
      createJob({
        id: "job_failed_composite",
        job_type: "FINAL_COMPOSITE",
        status: "FAILED",
        output_artifact_ids: ["art_failed"],
      }),
    ];

    const artifactId = mapLatestFinalCompositeArtifactId(jobs);
    expect(artifactId).toBeNull();
  });

  it("returns latest successful zone or refine artifact when present", () => {
    const jobs: JobRead[] = [
      createJob({
        id: "job_final",
        job_type: "FINAL_COMPOSITE",
        output_artifact_ids: ["art_comp"],
        created_at: "2026-03-02T10:00:00Z",
      }),
      createJob({
        id: "job_zone",
        job_type: "ZONE_RENDER",
        output_artifact_ids: ["art_zone_comp", "art_zone_1"],
        created_at: "2026-03-02T11:00:00Z",
      }),
      createJob({
        id: "job_refine",
        job_type: "REFINE",
        output_artifact_ids: ["art_refined"],
        created_at: "2026-03-02T12:00:00Z",
      }),
    ];

    const artifactId = mapLatestFinalCompositeArtifactId(jobs);
    expect(artifactId).toBe("art_refined");
  });
});

describe("mapRecentSuccessfulArtifacts", () => {
  it("returns recent successful artifacts ordered by created timestamp", () => {
    const jobs: JobRead[] = [
      createJob({
        id: "job_old",
        job_type: "SKETCH",
        input: { target_object_id: "obj_hero" },
        output_artifact_ids: ["art_old"],
        created_at: "2026-03-02T10:00:00Z",
      }),
      createJob({
        id: "job_new",
        job_type: "FINAL_COMPOSITE",
        output_artifact_ids: ["art_new_primary", "art_new_secondary"],
        created_at: "2026-03-02T11:00:00Z",
      }),
      createJob({
        id: "job_failed",
        status: "FAILED",
        output_artifact_ids: ["art_failed"],
        created_at: "2026-03-02T12:00:00Z",
      }),
    ];

    const recent = mapRecentSuccessfulArtifacts(jobs, 3);
    expect(recent).toEqual([
      {
        artifactId: "art_new_primary",
        jobId: "job_new",
        jobType: "FINAL_COMPOSITE",
        targetObjectId: null,
        createdAt: "2026-03-02T11:00:00Z",
      },
      {
        artifactId: "art_new_secondary",
        jobId: "job_new",
        jobType: "FINAL_COMPOSITE",
        targetObjectId: null,
        createdAt: "2026-03-02T11:00:00Z",
      },
      {
        artifactId: "art_old",
        jobId: "job_old",
        jobType: "SKETCH",
        targetObjectId: "obj_hero",
        createdAt: "2026-03-02T10:00:00Z",
      },
    ]);
  });

  it("enforces limit and ignores empty artifact ids", () => {
    const jobs: JobRead[] = [
      createJob({
        id: "job_1",
        job_type: "OBJECT_RENDER",
        output_artifact_ids: ["", "art_1"],
        created_at: "2026-03-02T10:00:00Z",
      }),
      createJob({
        id: "job_2",
        job_type: "REFINE",
        output_artifact_ids: ["art_2"],
        created_at: "2026-03-02T11:00:00Z",
      }),
    ];

    const recent = mapRecentSuccessfulArtifacts(jobs, 1);
    expect(recent).toHaveLength(1);
    expect(recent[0]?.artifactId).toBe("art_2");
  });
});
