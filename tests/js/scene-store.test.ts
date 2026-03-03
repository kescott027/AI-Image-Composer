import { describe, expect, it } from "vitest";

import {
  addLayerCommand,
  addObjectCommand,
  moveObjectCommand,
  moveObjectZOrderCommand,
  moveLayerCommand,
  rotateObjectCommand,
  scaleObjectCommand,
  setObjectNegativePromptCommand,
  setObjectPromptCommand,
  setNegativePromptCommand,
  setOverarchingPromptCommand,
  setStylePresetCommand,
  toggleLayerLockCommand,
} from "../../apps/web/src/state/commands";
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

  it("updates scene-level prompt fields through commands", () => {
    let state = createInitialSceneStoreState("scene_store_prompt_fields");

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: setOverarchingPromptCommand("A bright retro diner at sunrise"),
    });
    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: setNegativePromptCommand("blurry, low contrast"),
    });
    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: setStylePresetCommand("cinematic"),
    });

    expect(state.sceneSpec.scene.overarching_prompt).toBe("A bright retro diner at sunrise");
    expect(state.sceneSpec.scene.negative_prompt).toBe("blurry, low contrast");
    expect(state.sceneSpec.scene.style_preset).toBe("cinematic");

    state = sceneStoreReducer(state, { type: "UNDO" });
    expect(state.sceneSpec.scene.style_preset).toBe("default");
    state = sceneStoreReducer(state, { type: "UNDO" });
    expect(state.sceneSpec.scene.negative_prompt).toBe("");
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
    expect(state.sceneSpec.objects[0]?.transform?.z_index).toBe(0);
  });

  it("updates object transform and z-order through commands", () => {
    let state = createInitialSceneStoreState("scene_store_5");
    const objectLayer = state.sceneSpec.layers.find((layer) => layer.type === "OBJECT");
    expect(objectLayer).toBeDefined();
    if (!objectLayer) {
      return;
    }

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: addObjectCommand(objectLayer.id, "Hero"),
    });
    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: addObjectCommand(objectLayer.id, "Villain"),
    });

    const hero = state.sceneSpec.objects.find((object) => object.name === "Hero");
    expect(hero).toBeDefined();
    if (!hero) {
      return;
    }

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: moveObjectCommand(hero.id, 25, -10),
    });
    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: rotateObjectCommand(hero.id, 30),
    });
    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: scaleObjectCommand(hero.id, 1.1),
    });
    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: moveObjectZOrderCommand(hero.id, "UP"),
    });

    const updatedHero = state.sceneSpec.objects.find((object) => object.id === hero.id);
    expect(updatedHero?.transform?.x).toBe(105);
    expect(updatedHero?.transform?.y).toBe(80);
    expect(updatedHero?.transform?.rotation_deg).toBe(30);
    expect(updatedHero?.transform?.scale_x).toBe(1.1);
    expect(updatedHero?.transform?.scale_y).toBe(1.1);
    expect(updatedHero?.transform?.z_index).toBe(1);
  });

  it("updates per-object prompt fields through commands", () => {
    let state = createInitialSceneStoreState("scene_store_object_prompts");
    const objectLayer = state.sceneSpec.layers.find((layer) => layer.type === "OBJECT");
    expect(objectLayer).toBeDefined();
    if (!objectLayer) {
      return;
    }

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: addObjectCommand(objectLayer.id, "Guide"),
    });

    const guide = state.sceneSpec.objects.find((object) => object.name === "Guide");
    expect(guide).toBeDefined();
    if (!guide) {
      return;
    }

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: setObjectPromptCommand(guide.id, "A traveler in a red jacket"),
    });
    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: setObjectNegativePromptCommand(guide.id, "extra limbs, blur"),
    });

    const updatedGuide = state.sceneSpec.objects.find((object) => object.id === guide.id);
    expect(updatedGuide?.prompt).toBe("A traveler in a red jacket");
    expect(updatedGuide?.negative_prompt).toBe("extra limbs, blur");

    state = sceneStoreReducer(state, { type: "UNDO" });
    const undoneGuide = state.sceneSpec.objects.find((object) => object.id === guide.id);
    expect(undoneGuide?.negative_prompt).toBe("");
  });

  it("toggles lock and reorders layers", () => {
    let state = createInitialSceneStoreState("scene_store_4");
    const ordered = [...state.sceneSpec.layers].sort((a, b) => a.order - b.order);
    const middleLayer = ordered[1];
    expect(middleLayer).toBeDefined();
    if (!middleLayer) {
      return;
    }

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: toggleLayerLockCommand(middleLayer.id),
    });
    const lockedLayer = state.sceneSpec.layers.find((layer) => layer.id === middleLayer.id);
    expect(lockedLayer?.locked).toBe(true);

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: moveLayerCommand(middleLayer.id, "UP"),
    });
    const reordered = [...state.sceneSpec.layers].sort((a, b) => a.order - b.order);
    expect(reordered[0]?.id).toBe(middleLayer.id);
  });
});
