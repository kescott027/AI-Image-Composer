import { describe, expect, it } from "vitest";

import { addLayerCommand, addObjectCommand, setOverarchingPromptCommand } from "../../apps/web/src/state/commands";
import { createInitialSceneStoreState, sceneStoreReducer } from "../../apps/web/src/state/sceneState";

describe("scene store reducer", () => {
  it("creates initial state with seeded layers", () => {
    const state = createInitialSceneStoreState("scene_store_1");

    expect(state.sceneSpec.scene.id).toBe("scene_store_1");
    expect(state.sceneSpec.layers.map((layer) => layer.name)).toEqual([
      "Background",
      "Objects",
      "Composite",
    ]);
    expect(state.undoStack).toHaveLength(0);
    expect(state.redoStack).toHaveLength(0);
  });

  it("applies commands and supports undo/redo", () => {
    let state = createInitialSceneStoreState("scene_store_2");

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: setOverarchingPromptCommand("A neon skyline at dusk"),
    });

    expect(state.sceneSpec.scene.overarching_prompt).toBe("A neon skyline at dusk");
    expect(state.undoStack).toHaveLength(1);
    expect(state.redoStack).toHaveLength(0);

    state = sceneStoreReducer(state, { type: "UNDO" });
    expect(state.sceneSpec.scene.overarching_prompt).toBe("");
    expect(state.redoStack).toHaveLength(1);

    state = sceneStoreReducer(state, { type: "REDO" });
    expect(state.sceneSpec.scene.overarching_prompt).toBe("A neon skyline at dusk");
  });

  it("adds layers and objects through command actions", () => {
    let state = createInitialSceneStoreState("scene_store_3");

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: addLayerCommand("Foreground", "OBJECT"),
    });

    const objectLayer = state.sceneSpec.layers.find((layer) => layer.type === "OBJECT");
    expect(objectLayer).toBeDefined();

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: addObjectCommand(objectLayer?.id ?? "", "Hero"),
    });

    expect(state.sceneSpec.objects).toHaveLength(1);
    expect(state.sceneSpec.objects[0]?.name).toBe("Hero");
  });
});
