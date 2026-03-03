import { createEmptySceneSpec, type SceneSpec } from "@ai-image-composer/shared";

import type { SceneCommand } from "./commands";
import { addLayerCommand } from "./commands";

export interface SceneStoreState {
  sceneSpec: SceneSpec;
  undoStack: SceneSpec[];
  redoStack: SceneSpec[];
  commandLog: string[];
}

export type SceneStoreAction =
  | { type: "EXECUTE_COMMAND"; command: SceneCommand }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET_SCENE"; sceneId: string }
  | { type: "LOAD_SCENE_SPEC"; sceneSpec: SceneSpec };

function cloneSceneSpec(sceneSpec: SceneSpec): SceneSpec {
  return JSON.parse(JSON.stringify(sceneSpec)) as SceneSpec;
}

function seedScene(sceneId: string): SceneSpec {
  const sceneSpec = createEmptySceneSpec(sceneId, "Untitled Scene");
  const seeded = addLayerCommand("Background", "BACKGROUND").apply(sceneSpec);
  const withObjects = addLayerCommand("Objects", "OBJECT").apply(seeded);
  return addLayerCommand("Composite", "COMPOSITE").apply(withObjects);
}

export function createInitialSceneStoreState(sceneId: string): SceneStoreState {
  return {
    sceneSpec: seedScene(sceneId),
    undoStack: [],
    redoStack: [],
    commandLog: [],
  };
}

export function sceneStoreReducer(
  state: SceneStoreState,
  action: SceneStoreAction,
): SceneStoreState {
  switch (action.type) {
    case "EXECUTE_COMMAND": {
      const nextSceneSpec = action.command.apply(state.sceneSpec);
      return {
        sceneSpec: nextSceneSpec,
        undoStack: [...state.undoStack, cloneSceneSpec(state.sceneSpec)],
        redoStack: [],
        commandLog: [...state.commandLog, action.command.name],
      };
    }
    case "UNDO": {
      if (state.undoStack.length === 0) {
        return state;
      }

      const undoStack = [...state.undoStack];
      const previousSceneSpec = undoStack.pop();
      if (!previousSceneSpec) {
        return state;
      }

      return {
        sceneSpec: previousSceneSpec,
        undoStack,
        redoStack: [...state.redoStack, cloneSceneSpec(state.sceneSpec)],
        commandLog: [...state.commandLog, "UNDO"],
      };
    }
    case "REDO": {
      if (state.redoStack.length === 0) {
        return state;
      }

      const redoStack = [...state.redoStack];
      const redoneSceneSpec = redoStack.pop();
      if (!redoneSceneSpec) {
        return state;
      }

      return {
        sceneSpec: redoneSceneSpec,
        undoStack: [...state.undoStack, cloneSceneSpec(state.sceneSpec)],
        redoStack,
        commandLog: [...state.commandLog, "REDO"],
      };
    }
    case "RESET_SCENE": {
      return createInitialSceneStoreState(action.sceneId);
    }
    case "LOAD_SCENE_SPEC": {
      return {
        sceneSpec: cloneSceneSpec(action.sceneSpec),
        undoStack: [],
        redoStack: [],
        commandLog: [...state.commandLog, "LOAD_SCENE_SPEC"],
      };
    }
    default: {
      return state;
    }
  }
}
