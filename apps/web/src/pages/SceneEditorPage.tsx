import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ROUTES } from "../routes";
import { addLayerCommand, addObjectCommand, setOverarchingPromptCommand, toggleLayerVisibilityCommand } from "../state/commands";
import { SceneStoreProvider, useSceneStore } from "../state/sceneStore";

function SceneEditorShell({ sceneId }: { sceneId: string }) {
  const [promptDraft, setPromptDraft] = useState("");
  const { sceneSpec, commandLog, canUndo, canRedo, executeCommand, undo, redo } = useSceneStore();

  useEffect(() => {
    setPromptDraft(sceneSpec.scene.overarching_prompt);
  }, [sceneSpec.scene.overarching_prompt]);

  const objectLayer = useMemo(
    () => sceneSpec.layers.find((layer) => layer.type === "OBJECT"),
    [sceneSpec.layers],
  );

  const applyPrompt = () => {
    executeCommand(setOverarchingPromptCommand(promptDraft));
  };

  const addObject = () => {
    if (!objectLayer) {
      return;
    }
    executeCommand(addObjectCommand(objectLayer.id, `Object ${sceneSpec.objects.length + 1}`));
  };

  return (
    <main className="editor-wrap">
      <header className="editor-header">
        <div>
          <h1>Scene Editor</h1>
          <p>Scene: {sceneId || "unknown"}</p>
        </div>
        <div className="toolbar-cluster">
          <button type="button" className="button-link" onClick={undo} disabled={!canUndo}>
            Undo
          </button>
          <button type="button" className="button-link" onClick={redo} disabled={!canRedo}>
            Redo
          </button>
          <Link to={ROUTES.projects} className="button-link">
            Projects
          </Link>
        </div>
      </header>

      <section className="editor-grid">
        <aside className="panel panel-left">
          <h2>Left Panel</h2>
          <p>Layers and object controls</p>
          <div className="panel-actions">
            <button
              type="button"
              className="button-link"
              onClick={() => executeCommand(addLayerCommand(`Layer ${sceneSpec.layers.length + 1}`))}
            >
              Add Layer
            </button>
            <button
              type="button"
              className="button-link"
              onClick={addObject}
              disabled={!objectLayer}
            >
              Add Object
            </button>
          </div>
          <ul>
            {sceneSpec.layers.map((layer) => (
              <li key={layer.id}>
                {layer.name} ({layer.type})
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => executeCommand(toggleLayerVisibilityCommand(layer.id))}
                >
                  {layer.visible ? "Hide" : "Show"}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="canvas-panel" aria-label="Canvas panel">
          <h2>Canvas</h2>
          <div className="canvas-placeholder">
            <div>
              <p>Objects in scene: {sceneSpec.objects.length}</p>
              <p>Overarching prompt: {sceneSpec.scene.overarching_prompt || "(empty)"}</p>
            </div>
          </div>
        </section>

        <aside className="panel panel-right">
          <h2>Right Panel</h2>
          <p>Prompt and command history</p>
          <label className="field-label" htmlFor="prompt-draft">
            Overarching Prompt
          </label>
          <textarea
            id="prompt-draft"
            className="prompt-input"
            value={promptDraft}
            onChange={(event) => setPromptDraft(event.target.value)}
            placeholder="Describe the scene..."
          />
          <button type="button" className="button-link" onClick={applyPrompt}>
            Apply Prompt Command
          </button>
          <ul className="history-list">
            {commandLog.slice(-6).reverse().map((entry, index) => (
              <li key={`${entry}-${index}`}>{entry}</li>
            ))}
          </ul>
        </aside>
      </section>
    </main>
  );
}

export function SceneEditorPage() {
  const { sceneId = "" } = useParams();
  const resolvedSceneId = sceneId || "scene_unknown";

  return (
    <SceneStoreProvider key={resolvedSceneId} sceneId={resolvedSceneId}>
      <SceneEditorShell sceneId={resolvedSceneId} />
    </SceneStoreProvider>
  );
}
