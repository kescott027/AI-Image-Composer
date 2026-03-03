import { afterEach, describe, expect, it, vi } from "vitest";

import { createEmptySceneSpec } from "../../packages/shared/src/scenespec";
import { buildGenerationInput, createJob } from "../../apps/web/src/api/jobs";

describe("jobs api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits a create job request and returns the queued job", async () => {
    const queuedJob = {
      id: "job_123",
      scene_id: "scene_123",
      job_type: "SKETCH",
      status: "QUEUED",
      priority: 0,
      input_hash: "sha256:abc",
      input: { source: "test" },
      output_artifact_ids: [],
      logs: [],
      error: null,
      started_at: null,
      finished_at: null,
      created_at: "2026-03-03T00:00:00Z",
    };

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(queuedJob), { status: 200 }));

    const result = await createJob({
      scene_id: "scene_123",
      job_type: "SKETCH",
      input: { source: "test" },
    });

    expect(result.id).toBe("job_123");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/jobs");
    expect(requestInit).toBeDefined();
    expect((requestInit as RequestInit).method).toBe("POST");

    const body = JSON.parse(String((requestInit as RequestInit).body));
    expect(body).toMatchObject({
      scene_id: "scene_123",
      job_type: "SKETCH",
      priority: 0,
      input: { source: "test" },
    });
  });

  it("surfaces API error details on failed job creation", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Scene not found" }), { status: 404 }),
    );

    await expect(
      createJob({
        scene_id: "scene_missing",
        job_type: "FINAL_COMPOSITE",
      }),
    ).rejects.toThrow("Scene not found");
  });

  it("builds generation input with scene snapshot metadata", () => {
    const sceneSpec = createEmptySceneSpec("scene_input_1", "Input Test Scene");

    const input = buildGenerationInput(sceneSpec, { targetObjectId: "obj_1" });

    expect(input.scene_spec).toMatchObject({
      scene: {
        id: "scene_input_1",
      },
    });
    expect(input.target_object_id).toBe("obj_1");
    expect(input.requested_from).toBe("web_editor");
    expect(typeof input.requested_at).toBe("string");
  });
});
