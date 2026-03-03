import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  buildGenerationInput,
  createJob,
  type JobRead,
  type SupportedJobType,
} from "../api/jobs";
import {
  createSceneVersion,
  getSceneSpec,
  getSceneVersion,
  listSceneVersions,
  upsertSceneSpec,
  type SceneVersionRead,
} from "../api/scenes";
import { JobStatusPanel } from "../components/JobStatusPanel";
import { LayersPanel } from "../components/LayersPanel";
import { ObjectPromptEditor, type ObjectPromptEditorValues } from "../components/ObjectPromptEditor";
import {
  type OverarchingPromptEditorValues,
  OverarchingPromptEditor,
} from "../components/OverarchingPromptEditor";
import { RelationsEditor } from "../components/RelationsEditor";
import { SceneCanvas } from "../components/SceneCanvas";
import { ROUTES } from "../routes";
import {
  mapLatestFinalCompositeArtifactId,
  mapLatestObjectRenderArtifactsByObjectId,
  mapLatestSketchArtifactsByObjectId,
} from "../state/jobArtifacts";
import {
  addObjectCommand,
  moveObjectCommand,
  moveObjectZOrderCommand,
  rotateObjectCommand,
  scaleObjectCommand,
  setNegativePromptCommand,
  setObjectNegativePromptCommand,
  setObjectPromptCommand,
  setOverarchingPromptCommand,
  setStylePresetCommand,
} from "../state/commands";
import { SceneStoreProvider, useSceneStore } from "../state/sceneStore";

function SceneEditorShell({ sceneId }: { sceneId: string }) {
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [sceneJobs, setSceneJobs] = useState<JobRead[]>([]);
  const [showFinalComposite, setShowFinalComposite] = useState(true);
  const [activeSubmission, setActiveSubmission] = useState<SupportedJobType | null>(null);
  const [jobFeedback, setJobFeedback] = useState("No generation jobs submitted yet.");
  const [sceneLoadMessage, setSceneLoadMessage] = useState("Loading scene...");
  const [sceneVersionMessage, setSceneVersionMessage] = useState("No manual versions saved yet.");
  const [persistMessage, setPersistMessage] = useState("Scene persistence idle.");
  const [sceneVersions, setSceneVersions] = useState<SceneVersionRead[]>([]);
  const [isHydratedFromApi, setIsHydratedFromApi] = useState(false);
  const [isLoadingScene, setIsLoadingScene] = useState(true);
  const [isPersistingScene, setIsPersistingScene] = useState(false);
  const [isSavingVersion, setIsSavingVersion] = useState(false);

  const autosaveSkipRef = useRef(true);

  const {
    sceneSpec,
    commandLog,
    canUndo,
    canRedo,
    executeCommand,
    undo,
    redo,
    loadSceneSpec,
  } = useSceneStore();

  const objectLayer = useMemo(
    () => sceneSpec.layers.find((layer) => layer.type === "OBJECT"),
    [sceneSpec.layers],
  );
  const selectedObject = useMemo(
    () => sceneSpec.objects.find((object) => object.id === selectedObjectId) ?? null,
    [sceneSpec.objects, selectedObjectId],
  );

  const wireframeArtifactsByObjectId = useMemo(
    () => mapLatestSketchArtifactsByObjectId(sceneJobs),
    [sceneJobs],
  );
  const objectRenderArtifactsByObjectId = useMemo(
    () => mapLatestObjectRenderArtifactsByObjectId(sceneJobs),
    [sceneJobs],
  );
  const finalCompositeArtifactId = useMemo(
    () => mapLatestFinalCompositeArtifactId(sceneJobs),
    [sceneJobs],
  );

  const refreshSceneVersions = useCallback(async () => {
    try {
      const versions = await listSceneVersions(sceneId);
      setSceneVersions(versions);
      if (versions.length === 0) {
        setSceneVersionMessage("No saved versions yet.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch versions";
      setSceneVersionMessage(`Version list unavailable: ${message}`);
    }
  }, [sceneId]);

  useEffect(() => {
    let isActive = true;

    const hydrateFromApi = async () => {
      setIsLoadingScene(true);
      setSceneLoadMessage("Loading scene from API...");
      try {
        const loaded = await getSceneSpec(sceneId);
        if (!isActive) {
          return;
        }
        loadSceneSpec(loaded);
        setIsHydratedFromApi(true);
        setSceneLoadMessage("Scene loaded from API.");
      } catch (error) {
        if (!isActive) {
          return;
        }
        const message = error instanceof Error ? error.message : "Failed to load scene spec";
        setSceneLoadMessage(`Using local scene seed: ${message}`);
        setIsHydratedFromApi(false);
      } finally {
        if (isActive) {
          setIsLoadingScene(false);
        }
      }

      await refreshSceneVersions();
    };

    void hydrateFromApi();
    return () => {
      isActive = false;
    };
  }, [loadSceneSpec, refreshSceneVersions, sceneId]);

  useEffect(() => {
    if (!isHydratedFromApi || isLoadingScene) {
      return;
    }

    if (autosaveSkipRef.current) {
      autosaveSkipRef.current = false;
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setPersistMessage("Auto-saving scene spec...");
        await upsertSceneSpec(sceneId, sceneSpec);
        setPersistMessage(`Auto-saved at ${new Date().toLocaleTimeString()}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to auto-save";
        setPersistMessage(`Auto-save failed: ${message}`);
      }
    }, 900);

    return () => {
      window.clearTimeout(timer);
    };
  }, [sceneId, sceneSpec, isHydratedFromApi, isLoadingScene, commandLog.length]);

  const saveScene = useCallback(async () => {
    setIsPersistingScene(true);
    try {
      await upsertSceneSpec(sceneId, sceneSpec);
      setPersistMessage(`Scene saved at ${new Date().toLocaleTimeString()}.`);
      await refreshSceneVersions();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save scene";
      setPersistMessage(`Save failed: ${message}`);
    } finally {
      setIsPersistingScene(false);
    }
  }, [refreshSceneVersions, sceneId, sceneSpec]);

  const saveVersion = useCallback(async () => {
    setIsSavingVersion(true);
    try {
      const result = await createSceneVersion(sceneId, sceneSpec);
      setSceneVersionMessage(`Saved version ${result.version.version_number}.`);
      await refreshSceneVersions();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save version";
      setSceneVersionMessage(`Save version failed: ${message}`);
    } finally {
      setIsSavingVersion(false);
    }
  }, [refreshSceneVersions, sceneId, sceneSpec]);

  const restoreVersion = useCallback(
    async (versionNumber: number) => {
      try {
        const restored = await getSceneVersion(sceneId, versionNumber);
        loadSceneSpec(restored);
        setSceneVersionMessage(`Restored version ${versionNumber}.`);
        setPersistMessage("Version restored. Save or keep editing.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to restore version";
        setSceneVersionMessage(`Restore failed: ${message}`);
      }
    },
    [loadSceneSpec, sceneId],
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
    if (jobType === "SKETCH" && !selectedObject) {
      setJobFeedback("Select an object before submitting a SKETCH job.");
      return;
    }
    if (jobType === "OBJECT_RENDER" && !selectedObject) {
      setJobFeedback("Select an object before submitting an OBJECT_RENDER job.");
      return;
    }

    setActiveSubmission(jobType);
    setJobFeedback(`Submitting ${jobType} job...`);

    try {
      await upsertSceneSpec(sceneId, sceneSpec);
      const input =
        (jobType === "OBJECT_RENDER" || jobType === "SKETCH") && selectedObject
          ? buildGenerationInput(sceneSpec, { targetObjectId: selectedObject.id })
          : buildGenerationInput(sceneSpec);
      const job = await createJob({
        scene_id: sceneSpec.scene.id,
        job_type: jobType,
        input,
      });
      setJobFeedback(`Queued ${job.job_type} as ${job.id} (status: ${job.status}).`);
      setPersistMessage("Scene snapshot persisted for queued job.");
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
          <p>{sceneLoadMessage}</p>
        </div>
        <div className="toolbar-cluster">
          <button type="button" className="button-link" onClick={undo} disabled={!canUndo}>
            Undo
          </button>
          <button type="button" className="button-link" onClick={redo} disabled={!canRedo}>
            Redo
          </button>
          <button type="button" className="button-link" onClick={() => void saveScene()} disabled={isPersistingScene}>
            Save Scene
          </button>
          <button type="button" className="button-link" onClick={() => void saveVersion()} disabled={isSavingVersion || isLoadingScene}>
            Save Version
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
          wireframeArtifactsByObjectId={wireframeArtifactsByObjectId}
          objectRenderArtifactsByObjectId={objectRenderArtifactsByObjectId}
          finalCompositeArtifactId={showFinalComposite ? finalCompositeArtifactId : null}
          onSelectObject={setSelectedObjectId}
        />

        <aside className="panel panel-right">
          <h2>Right Panel</h2>
          <p>Prompt, constraints, generation, and version history</p>
          <p className="generation-status">{persistMessage}</p>
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
          <RelationsEditor sceneSpec={sceneSpec} executeCommand={executeCommand} />
          <section className="generation-tools">
            <h3>Generation Jobs</h3>
            <p>Queue backend jobs. SKETCH and OBJECT_RENDER use the selected object.</p>
            <div className="tool-row">
              <button
                type="button"
                className="button-link"
                onClick={() => void submitGenerationJob("SKETCH")}
                disabled={activeSubmission !== null || !selectedObject}
              >
                Generate Wireframe
              </button>
              <button
                type="button"
                className="button-link"
                onClick={() => void submitGenerationJob("OBJECT_RENDER")}
                disabled={activeSubmission !== null || !selectedObject}
              >
                Render Object
              </button>
              <button
                type="button"
                className="button-link"
                onClick={() => void submitGenerationJob("FINAL_COMPOSITE")}
                disabled={activeSubmission !== null}
              >
                Generate Composite
              </button>
            </div>
            <div className="tool-row">
              <button
                type="button"
                className="mini-button"
                onClick={() => setShowFinalComposite((current) => !current)}
                disabled={!finalCompositeArtifactId}
              >
                {showFinalComposite ? "Hide Composite Layer" : "Show Composite Layer"}
              </button>
            </div>
            <p className="generation-status">{jobFeedback}</p>
            <p className="generation-status">
              Latest composite: {finalCompositeArtifactId ?? "none"}
            </p>
          </section>
          <section className="scene-versions-panel">
            <h3>Scene Versions</h3>
            <p>{sceneVersionMessage}</p>
            {sceneVersions.length === 0 ? (
              <p className="job-empty">No save points yet.</p>
            ) : (
              <ul className="version-list">
                {sceneVersions.map((version) => (
                  <li key={version.id} className="version-item">
                    <span>
                      v{version.version_number} {version.created_at ? `(${new Date(version.created_at).toLocaleString()})` : ""}
                    </span>
                    <button
                      type="button"
                      className="mini-button"
                      onClick={() => void restoreVersion(version.version_number)}
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <JobStatusPanel sceneId={sceneSpec.scene.id} onJobsUpdate={setSceneJobs} />
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
