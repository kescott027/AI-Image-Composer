import { describe, expect, it } from "vitest";

import {
  addLayerCommand,
  addObjectCommand,
  addZoneLassoCommand,
  addZoneRectCommand,
  duplicateObjectCommand,
  moveObjectCommand,
  moveObjectZOrderCommand,
  moveLayerCommand,
  removeObjectCommand,
  renameObjectCommand,
  rotateObjectCommand,
  setZoneObjectInclusionCommand,
  setZoneSelectionModeCommand,
  updateZoneCommand,
  setRefineStrengthCommand,
  scaleObjectCommand,
  setObjectNegativePromptCommand,
  setObjectPromptCommand,
  setNegativePromptCommand,
  setOverarchingPromptCommand,
  setStylePresetCommand,
  toggleLayerLockCommand,
} from "../../apps/web/src/state/commands";
import {
  createInitialSceneStoreState,
  sceneStoreReducer,
} from "../../apps/web/src/state/sceneState";

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

  it("loads scene spec snapshots and clears undo/redo stacks", () => {
    let state = createInitialSceneStoreState("scene_store_load");

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: setOverarchingPromptCommand("before-load"),
    });
    expect(state.undoStack).toHaveLength(1);

    const loaded = createInitialSceneStoreState("scene_store_loaded").sceneSpec;
    loaded.scene.overarching_prompt = "loaded prompt";

    state = sceneStoreReducer(state, {
      type: "LOAD_SCENE_SPEC",
      sceneSpec: loaded,
    });

    expect(state.sceneSpec.scene.id).toBe("scene_store_loaded");
    expect(state.sceneSpec.scene.overarching_prompt).toBe("loaded prompt");
    expect(state.undoStack).toHaveLength(0);
    expect(state.redoStack).toHaveLength(0);
    expect(state.commandLog.at(-1)).toBe("LOAD_SCENE_SPEC");
  });

  it("adds zone shapes and updates refine strength through commands", () => {
    let state = createInitialSceneStoreState("scene_store_zones");
    const objectLayer = state.sceneSpec.layers.find((layer) => layer.type === "OBJECT");
    expect(objectLayer).toBeDefined();
    if (!objectLayer) {
      return;
    }

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: addObjectCommand(objectLayer.id, "Anchor"),
    });

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: addZoneRectCommand("Rect Zone", 20, 30, 180, 120),
    });
    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: addZoneLassoCommand("Lasso Zone", [
        { x: 80, y: 80 },
        { x: 180, y: 90 },
        { x: 140, y: 170 },
      ]),
    });
    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: setRefineStrengthCommand(0.45),
    });

    expect(state.sceneSpec.zones).toHaveLength(2);
    expect(state.sceneSpec.zones[0]?.shape.type).toBe("rect");
    expect(state.sceneSpec.zones[1]?.shape.type).toBe("lasso");
    expect(state.sceneSpec.zones[0]?.included_object_ids.length).toBe(1);
    expect(state.sceneSpec.settings.defaults.refine_strength).toBe(0.45);
  });

  it("supports object rename, duplicate, and delete lifecycle", () => {
    let state = createInitialSceneStoreState("scene_store_object_lifecycle");
    const objectLayer = state.sceneSpec.layers.find((layer) => layer.type === "OBJECT");
    expect(objectLayer).toBeDefined();
    if (!objectLayer) {
      return;
    }

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: addObjectCommand(objectLayer.id, "Hero"),
    });

    const hero = state.sceneSpec.objects.find((object) => object.name === "Hero");
    expect(hero).toBeDefined();
    if (!hero) {
      return;
    }

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: renameObjectCommand(hero.id, "Lead"),
    });
    expect(state.sceneSpec.objects[0]?.name).toBe("Lead");

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: duplicateObjectCommand(hero.id),
    });
    expect(state.sceneSpec.objects).toHaveLength(2);
    expect(state.sceneSpec.objects.some((object) => object.name.startsWith("Lead Copy"))).toBe(
      true,
    );

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: removeObjectCommand(hero.id),
    });
    expect(state.sceneSpec.objects).toHaveLength(1);
    expect(state.sceneSpec.objects[0]?.name.startsWith("Lead Copy")).toBe(true);
  });

  it("supports zone edits and manual include/exclude object assignment", () => {
    let state = createInitialSceneStoreState("scene_store_zone_manage");
    const objectLayer = state.sceneSpec.layers.find((layer) => layer.type === "OBJECT");
    expect(objectLayer).toBeDefined();
    if (!objectLayer) {
      return;
    }

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: addObjectCommand(objectLayer.id, "Obj A"),
    });
    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: addObjectCommand(objectLayer.id, "Obj B"),
    });

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: addZoneRectCommand("Zone 1", 40, 50, 200, 120),
    });
    const zone = state.sceneSpec.zones[0];
    expect(zone).toBeDefined();
    if (!zone) {
      return;
    }

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: updateZoneCommand(zone.id, {
        name: "Primary Zone",
        x: 60,
        y: 65,
        width: 180,
        height: 115,
      }),
    });
    const updatedZone = state.sceneSpec.zones.find((candidate) => candidate.id === zone.id);
    expect(updatedZone?.name).toBe("Primary Zone");
    expect(updatedZone?.shape.x).toBe(60);
    expect(updatedZone?.shape.width).toBe(180);

    const firstObject = state.sceneSpec.objects[0];
    expect(firstObject).toBeDefined();
    if (!firstObject) {
      return;
    }

    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: setZoneSelectionModeCommand(zone.id, "MANUAL"),
    });
    state = sceneStoreReducer(state, {
      type: "EXECUTE_COMMAND",
      command: setZoneObjectInclusionCommand(zone.id, firstObject.id, false),
    });

    const manualZone = state.sceneSpec.zones.find((candidate) => candidate.id === zone.id);
    expect(manualZone?.selection_mode).toBe("MANUAL");
    expect(manualZone?.included_object_ids.includes(firstObject.id)).toBe(false);
  });
});
