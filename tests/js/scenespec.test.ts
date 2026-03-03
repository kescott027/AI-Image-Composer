import { describe, expect, it } from "vitest";

import {
  SCENE_SPEC_SCHEMA_VERSION,
  createEmptySceneSpec,
} from "../../packages/shared/src/scenespec";

describe("SceneSpec helpers", () => {
  it("creates an empty SceneSpec with canonical schema version", () => {
    const spec = createEmptySceneSpec("scene_1", "My Scene");

    expect(spec.schema_version).toBe(SCENE_SPEC_SCHEMA_VERSION);
    expect(spec.scene.id).toBe("scene_1");
    expect(spec.layers).toHaveLength(0);
  });
});
