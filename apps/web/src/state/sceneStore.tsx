import { createContext, type ReactNode, useCallback, useContext, useMemo, useReducer } from "react";
import type { SceneSpec } from "@ai-image-composer/shared";

import type { SceneCommand } from "./commands";
import { createInitialSceneStoreState, sceneStoreReducer } from "./sceneState";

interface SceneStoreContextValue {
  state: ReturnType<typeof createInitialSceneStoreState>;
  executeCommand: (command: SceneCommand) => void;
  undo: () => void;
  redo: () => void;
  resetScene: (sceneId: string) => void;
  loadSceneSpec: (sceneSpec: SceneSpec) => void;
}

const SceneStoreContext = createContext<SceneStoreContextValue | null>(null);

interface SceneStoreProviderProps {
  sceneId: string;
  children: ReactNode;
}

export function SceneStoreProvider({ sceneId, children }: SceneStoreProviderProps) {
  const [state, dispatch] = useReducer(
    sceneStoreReducer,
    sceneId,
    createInitialSceneStoreState,
  );

  const executeCommand = useCallback((command: SceneCommand) => {
    dispatch({ type: "EXECUTE_COMMAND", command });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: "UNDO" });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "REDO" });
  }, []);

  const resetScene = useCallback((nextSceneId: string) => {
    dispatch({ type: "RESET_SCENE", sceneId: nextSceneId });
  }, []);

  const loadSceneSpec = useCallback((sceneSpec: SceneSpec) => {
    dispatch({ type: "LOAD_SCENE_SPEC", sceneSpec });
  }, []);

  const value = useMemo(
    () => ({ state, executeCommand, undo, redo, resetScene, loadSceneSpec }),
    [state, executeCommand, undo, redo, resetScene, loadSceneSpec],
  );

  return <SceneStoreContext.Provider value={value}>{children}</SceneStoreContext.Provider>;
}

export function useSceneStore() {
  const context = useContext(SceneStoreContext);
  if (!context) {
    throw new Error("useSceneStore must be used within a SceneStoreProvider");
  }

  return {
    sceneSpec: context.state.sceneSpec,
    commandLog: context.state.commandLog,
    canUndo: context.state.undoStack.length > 0,
    canRedo: context.state.redoStack.length > 0,
    executeCommand: context.executeCommand,
    undo: context.undo,
    redo: context.redo,
    resetScene: context.resetScene,
    loadSceneSpec: context.loadSceneSpec,
  };
}
