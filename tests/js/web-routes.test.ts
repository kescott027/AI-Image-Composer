import { describe, expect, it } from "vitest";

import { ROUTES } from "../../apps/web/src/routes";

describe("web routes", () => {
  it("exposes project and scene route builders", () => {
    expect(ROUTES.projects).toBe("/projects");
    expect(ROUTES.projectScenes("proj_1")).toBe("/projects/proj_1/scenes");
    expect(ROUTES.sceneEditor("scene_1")).toBe("/scenes/scene_1/editor");
  });
});
