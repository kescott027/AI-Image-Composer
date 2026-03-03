import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  buildGenerationInput,
  createJob,
  type SupportedJobType,
} from "../api/jobs";
import { LayersPanel } from "../components/LayersPanel";
import { ObjectPromptEditor, type ObjectPromptEditorValues } from "../components/ObjectPromptEditor";
import {
  type OverarchingPromptEditorValues,
  OverarchingPromptEditor,
} from "../components/OverarchingPromptEditor";
import { SceneCanvas } from "../components/SceneCanvas";
import { ROUTES } from "../routes";
import {
  addObjectCommand,
  moveObjectCommand,
  setObjectNegativePromptCommand,
  setObjectPromptCommand,
  moveObjectZOrderCommand,
  rotateObjectCommand,
  scaleObjectCommand,
  setNegativePromptCommand,
  setOverarchingPromptCommand,
  setStylePresetCommand,
} from "../state/commands";
import { SceneStoreProvider, useSceneStore } from "../state/sceneStore";

function SceneEditorShell({ sceneId }: { sceneId: string }) {
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [activeSubmission, setActiveSubmission] = useState<SupportedJobType | null>(null);
  const [jobFeedback, setJobFeedback] = useState("No generation jobs submitted yet.");
  const { sceneSpec, commandLog, canUndo, canRedo, executeCommand, undo, redo } = useSceneStore();

  const objectLayer = useMemo(
    () => sceneSpec.layers.find((layer) => layer.type === "OBJECT"),
    [sceneSpec.layers],
  );
  const selectedObject = useMemo(
    () => sceneSpec.objects.find((object) => object.id === selectedObjectId) ?? null,
    [sceneSpec.objects, selectedObjectId],
  );

  const applyScenePrompt = (values: OverarchingPromptEditorValues) => {
    if (values.overarchingPrompt !== sceneSpec.scene.overarching_prompt) {
      executeCommand(setOverarchingPromptCommand(values.overarchingPrompt));
    }
    if (values.negativePrompt !== (sceneSpec.scene.negative_prompt ?? "")) {
      executeCommand(setNegativePromptCommand(values.negativePrompt));
    }
    if (values.stylePreset !== (sceneSpec.scene.style_preset ?? "default")) {
      executeCommand(setStylePresetCommand(values.stylePreset));
    }
  };

  const applyObjectPrompt = (values: ObjectPromptEditorValues) => {
    if (!selectedObject) {
      return;
    }
    if (values.prompt !== selectedObject.prompt) {
      executeCommand(setObjectPromptCommand(selectedObject.id, values.prompt));
    }
    if (values.negativePrompt !== (selectedObject.negative_prompt ?? "")) {
      executeCommand(setObjectNegativePromptCommand(selectedObject.id, values.negativePrompt));
    }
  };

  const addObject = () => {
    if (!objectLayer) {
      return;
    }
    executeCommand(addObjectCommand(objectLayer.id, `Object ${sceneSpec.objects.length + 1}`));
  };

  const applyMove = (deltaX: number, deltaY: number) => {
    if (!selectedObject) {
      return;
    }
    executeCommand(moveObjectCommand(selectedObject.id, deltaX, deltaY));
  };

  const applyRotate = (deltaDeg: number) => {
    if (!selectedObject) {
      return;
    }
    executeCommand(rotateObjectCommand(selectedObject.id, deltaDeg));
  };

  const applyScale = (multiplier: number) => {
    if (!selectedObject) {
      return;
    }
    executeCommand(scaleObjectCommand(selectedObject.id, multiplier));
  };

  const applyZOrder = (direction: "UP" | "DOWN") => {
    if (!selectedObject) {
      return;
    }
    executeCommand(moveObjectZOrderCommand(selectedObject.id, direction));
  };

  const submitGenerationJob = async (jobType: SupportedJobType) => {
    if (jobType === "OBJECT_RENDER" && !selectedObject) {
      setJobFeedback("Select an object before submitting an OBJECT_RENDER job.");
      return;
    }

    setActiveSubmission(jobType);
    setJobFeedback(`Submitting ${jobType} job...`);

    try {
      const input =
        jobType === "OBJECT_RENDER" && selectedObject
          ? buildGenerationInput(sceneSpec, { targetObjectId: selectedObject.id })
          : buildGenerationInput(sceneSpec);
      const job = await createJob({
        scene_id: sceneSpec.scene.id,
        job_type: jobType,
        input,
      });
      setJobFeedback(`Queued ${job.job_type} as ${job.id} (status: ${job.status}).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown job submission error";
      setJobFeedback(`Job submission failed: ${message}`);
    } finally {
      setActiveSubmission(null);
    }
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

        <SceneCanvas
          sceneSpec={sceneSpec}
          selectedObjectId={selectedObjectId}
          onSelectObject={setSelectedObjectId}
        />

        <aside className="panel panel-right">
          <h2>Right Panel</h2>
          <p>Prompt and command history</p>
          <OverarchingPromptEditor scene={sceneSpec.scene} onApply={applyScenePrompt} />
          <button
            type="button"
            className="button-link"
            onClick={addObject}
            disabled={!objectLayer}
          >
            Add Object
          </button>
          <div className="object-tools">
            <h3>Object Transform</h3>
            <p>{selectedObject ? `Selected: ${selectedObject.name}` : "Select an object in canvas."}</p>
            <div className="tool-row">
              <button type="button" className="mini-button" onClick={() => applyMove(-12, 0)} disabled={!selectedObject}>
                Left
              </button>
              <button type="button" className="mini-button" onClick={() => applyMove(12, 0)} disabled={!selectedObject}>
                Right
              </button>
              <button type="button" className="mini-button" onClick={() => applyMove(0, -12)} disabled={!selectedObject}>
                Up
              </button>
              <button type="button" className="mini-button" onClick={() => applyMove(0, 12)} disabled={!selectedObject}>
                Down
              </button>
            </div>
            <div className="tool-row">
              <button type="button" className="mini-button" onClick={() => applyRotate(-15)} disabled={!selectedObject}>
                Rotate -15
              </button>
              <button type="button" className="mini-button" onClick={() => applyRotate(15)} disabled={!selectedObject}>
                Rotate +15
              </button>
              <button type="button" className="mini-button" onClick={() => applyScale(0.9)} disabled={!selectedObject}>
                Scale -10%
              </button>
              <button type="button" className="mini-button" onClick={() => applyScale(1.1)} disabled={!selectedObject}>
                Scale +10%
              </button>
            </div>
            <div className="tool-row">
              <button type="button" className="mini-button" onClick={() => applyZOrder("DOWN")} disabled={!selectedObject}>
                Send Back
              </button>
              <button type="button" className="mini-button" onClick={() => applyZOrder("UP")} disabled={!selectedObject}>
                Bring Front
              </button>
            </div>
          </div>
          <ObjectPromptEditor selectedObject={selectedObject} onApply={applyObjectPrompt} />
          <section className="generation-tools">
            <h3>Generation Jobs</h3>
            <p>Queue a backend job for this scene snapshot.</p>
            <div className="tool-row">
              <button
                type="button"
                className="button-link"
                onClick={() => submitGenerationJob("SKETCH")}
                disabled={activeSubmission !== null}
              >
                Generate Wireframe
              </button>
              <button
                type="button"
                className="button-link"
                onClick={() => submitGenerationJob("OBJECT_RENDER")}
                disabled={activeSubmission !== null || !selectedObject}
              >
                Render Object
              </button>
              <button
                type="button"
                className="button-link"
                onClick={() => submitGenerationJob("FINAL_COMPOSITE")}
                disabled={activeSubmission !== null}
              >
                Generate Composite
              </button>
            </div>
            <p className="generation-status">{jobFeedback}</p>
          </section>
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
