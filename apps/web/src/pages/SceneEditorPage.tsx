import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { LayersPanel } from "../components/LayersPanel";
import { SceneCanvas } from "../components/SceneCanvas";
import { ROUTES } from "../routes";
import { addObjectCommand, setOverarchingPromptCommand } from "../state/commands";
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
        <LayersPanel sceneSpec={sceneSpec} executeCommand={executeCommand} />

        <SceneCanvas sceneSpec={sceneSpec} />

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
          <button
            type="button"
            className="button-link"
            onClick={addObject}
            disabled={!objectLayer}
          >
            Add Object
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
