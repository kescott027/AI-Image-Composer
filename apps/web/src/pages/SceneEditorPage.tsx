import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { SceneSpec } from "@ai-image-composer/shared";

import {
  buildGenerationInput,
  createJob,
  type JobRead,
  type SupportedJobType,
} from "../api/jobs";
import {
  detectRelationConflicts,
  createSceneVersion,
  getSceneSpec,
  getSceneVersion,
  listSceneVersions,
  upsertSceneSpec,
  type RelationConflictRead,
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
import { type ZoneDrawingMode, ZoneEditor } from "../components/ZoneEditor";
import { ROUTES } from "../routes";
import {
  mapLatestFinalCompositeArtifactId,
  mapLatestObjectRenderArtifactsByObjectId,
  mapLatestSketchArtifactsByObjectId,
} from "../state/jobArtifacts";
import {
  addObjectCommand,
  addZoneLassoCommand,
  addZoneRectCommand,
  duplicateObjectCommand,
  moveObjectCommand,
  moveObjectZOrderCommand,
  removeObjectCommand,
  renameObjectCommand,
  rotateObjectCommand,
  setRefineStrengthCommand,
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
  const [relationConflicts, setRelationConflicts] = useState<RelationConflictRead[]>([]);
  const [relationConflictMessage, setRelationConflictMessage] = useState(
    "Relation validation is idle.",
  );
  const [zoneDrawingMode, setZoneDrawingMode] = useState<ZoneDrawingMode>("NONE");
  const [pendingZoneName, setPendingZoneName] = useState("Zone 1");
  const [pendingLassoPoints, setPendingLassoPoints] = useState<Array<{ x: number; y: number }>>(
    [],
  );
  const [isHydratedFromApi, setIsHydratedFromApi] = useState(false);
  const [isLoadingScene, setIsLoadingScene] = useState(true);
  const [isPersistingScene, setIsPersistingScene] = useState(false);
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [objectNameDraft, setObjectNameDraft] = useState("");

  const autosaveSkipRef = useRef(true);
  const latestSceneSpecRef = useRef<SceneSpec | null>(null);

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
  const relationSignature = useMemo(
    () =>
      sceneSpec.relations
        .map(
          (relation) =>
            `${relation.id}:${relation.subject_object_id}:${relation.predicate}:${relation.object_object_id}`,
        )
        .join("|"),
    [sceneSpec.relations],
  );
  const objectSignature = useMemo(
    () => sceneSpec.objects.map((object) => `${object.id}:${object.name}`).join("|"),
    [sceneSpec.objects],
  );

  useEffect(() => {
    latestSceneSpecRef.current = sceneSpec;
  }, [sceneSpec]);

  useEffect(() => {
    if (!selectedObjectId) {
      setObjectNameDraft("");
      return;
    }
    const selected = sceneSpec.objects.find((object) => object.id === selectedObjectId);
    if (!selected) {
      setSelectedObjectId(null);
      setObjectNameDraft("");
      return;
    }
    setObjectNameDraft(selected.name);
  }, [sceneSpec.objects, selectedObjectId]);

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

  useEffect(() => {
    if (!isHydratedFromApi || isLoadingScene) {
      return;
    }

    let isActive = true;
    const timer = window.setTimeout(async () => {
      setRelationConflictMessage("Validating directional relations...");
      try {
        const sceneSpecSnapshot = latestSceneSpecRef.current;
        if (!sceneSpecSnapshot) {
          return;
        }
        const conflicts = await detectRelationConflicts(sceneId, sceneSpecSnapshot);
        if (!isActive) {
          return;
        }
        setRelationConflicts(conflicts);
        setRelationConflictMessage(
          conflicts.length === 0
            ? "No directional conflicts detected."
            : `${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"} detected.`,
        );
      } catch (error) {
        if (!isActive) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Failed to validate relation constraints";
        setRelationConflictMessage(`Conflict validation unavailable: ${message}`);
      }
    }, 300);

    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [isHydratedFromApi, isLoadingScene, relationSignature, objectSignature, sceneId]);

  useEffect(() => {
    setPendingZoneName(`Zone ${sceneSpec.zones.length + 1}`);
  }, [sceneSpec.zones.length]);

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

  const beginRectZoneDrawing = () => {
    setPendingLassoPoints([]);
    setZoneDrawingMode("RECT");
  };

  const beginLassoZoneDrawing = () => {
    setPendingLassoPoints([]);
    setZoneDrawingMode("LASSO");
  };

  const cancelZoneDrawing = () => {
    setZoneDrawingMode("NONE");
    setPendingLassoPoints([]);
  };

  const createRectZone = (zone: { x: number; y: number; width: number; height: number }) => {
    executeCommand(addZoneRectCommand(pendingZoneName || `Zone ${sceneSpec.zones.length + 1}`, zone.x, zone.y, zone.width, zone.height));
    setZoneDrawingMode("NONE");
  };

  const appendLassoPoint = (point: { x: number; y: number }) => {
    setPendingLassoPoints((current) => [...current, point]);
  };

  const finishLassoZone = () => {
    if (pendingLassoPoints.length < 3) {
      return;
    }
    executeCommand(addZoneLassoCommand(pendingZoneName || `Zone ${sceneSpec.zones.length + 1}`, pendingLassoPoints));
    setPendingLassoPoints([]);
    setZoneDrawingMode("NONE");
  };

  const refineStrength = sceneSpec.settings.defaults.refine_strength ?? 0.25;

  const addObject = () => {
    if (!objectLayer) {
      return;
    }
    executeCommand(addObjectCommand(objectLayer.id, `Object ${sceneSpec.objects.length + 1}`));
  };

  const applyObjectRename = () => {
    if (!selectedObject || !objectNameDraft.trim()) {
      return;
    }
    executeCommand(renameObjectCommand(selectedObject.id, objectNameDraft));
  };

  const duplicateSelectedObject = () => {
    if (!selectedObject) {
      return;
    }
    executeCommand(duplicateObjectCommand(selectedObject.id));
  };

  const removeSelectedObject = () => {
    if (!selectedObject) {
      return;
    }
    executeCommand(removeObjectCommand(selectedObject.id));
    setSelectedObjectId(null);
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const withMeta = event.metaKey || event.ctrlKey;
      const moveStep = event.shiftKey ? 24 : 12;

      if (withMeta && key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if (withMeta && key === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (withMeta && key === "d" && selectedObject) {
        event.preventDefault();
        executeCommand(duplicateObjectCommand(selectedObject.id));
        return;
      }
      if ((key === "backspace" || key === "delete") && selectedObject) {
        event.preventDefault();
        executeCommand(removeObjectCommand(selectedObject.id));
        setSelectedObjectId(null);
        return;
      }
      if (key === "escape") {
        setZoneDrawingMode("NONE");
        setPendingLassoPoints([]);
        return;
      }
      if (!selectedObject) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        executeCommand(moveObjectCommand(selectedObject.id, -moveStep, 0));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        executeCommand(moveObjectCommand(selectedObject.id, moveStep, 0));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        executeCommand(moveObjectCommand(selectedObject.id, 0, -moveStep));
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        executeCommand(moveObjectCommand(selectedObject.id, 0, moveStep));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [executeCommand, redo, selectedObject, undo]);

  const submitGenerationJob = async (jobType: SupportedJobType) => {
    if (jobType === "SKETCH" && !selectedObject) {
      setJobFeedback("Select an object before submitting a SKETCH job.");
      return;
    }
    if (jobType === "OBJECT_RENDER" && !selectedObject) {
      setJobFeedback("Select an object before submitting an OBJECT_RENDER job.");
      return;
    }
    if (jobType === "ZONE_RENDER" && sceneSpec.zones.length === 0) {
      setJobFeedback("Define at least one zone before submitting a ZONE_RENDER job.");
      return;
    }
    if (jobType === "REFINE" && !finalCompositeArtifactId) {
      setJobFeedback("Generate a composite or zone render before submitting a REFINE job.");
      return;
    }

    setActiveSubmission(jobType);
    setJobFeedback(`Submitting ${jobType} job...`);

    try {
      await upsertSceneSpec(sceneId, sceneSpec);
      const inputOptions: { targetObjectId?: string; sourceArtifactId?: string } = {};
      if ((jobType === "OBJECT_RENDER" || jobType === "SKETCH") && selectedObject) {
        inputOptions.targetObjectId = selectedObject.id;
      }
      if (jobType === "REFINE" && finalCompositeArtifactId) {
        inputOptions.sourceArtifactId = finalCompositeArtifactId;
      }
      const input = buildGenerationInput(sceneSpec, inputOptions);
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
          zoneDrawingMode={zoneDrawingMode}
          pendingLassoPoints={pendingLassoPoints}
          onCreateRectZone={createRectZone}
          onAddLassoPoint={appendLassoPoint}
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
            <div className="tool-row object-manage-row">
              <input
                className="text-input object-name-input"
                value={objectNameDraft}
                onChange={(event) => setObjectNameDraft(event.target.value)}
                placeholder="Selected object name"
                disabled={!selectedObject}
              />
              <button type="button" className="mini-button" onClick={applyObjectRename} disabled={!selectedObject || !objectNameDraft.trim()}>
                Rename
              </button>
              <button type="button" className="mini-button" onClick={duplicateSelectedObject} disabled={!selectedObject}>
                Duplicate
              </button>
              <button type="button" className="mini-button" onClick={removeSelectedObject} disabled={!selectedObject}>
                Delete
              </button>
            </div>
            <p className="shortcut-hint">
              Shortcuts: Cmd/Ctrl+Z Undo, Cmd/Ctrl+Shift+Z Redo, Cmd/Ctrl+D Duplicate, Del Remove, Arrows Move, Shift+Arrows Fast Move.
            </p>
          </div>
          <ObjectPromptEditor selectedObject={selectedObject} onApply={applyObjectPrompt} />
          <RelationsEditor
            sceneSpec={sceneSpec}
            executeCommand={executeCommand}
            conflicts={relationConflicts}
            conflictMessage={relationConflictMessage}
          />
          <ZoneEditor
            sceneSpec={sceneSpec}
            executeCommand={executeCommand}
            drawingMode={zoneDrawingMode}
            pendingZoneName={pendingZoneName}
            pendingLassoPoints={pendingLassoPoints}
            onZoneNameChange={setPendingZoneName}
            onStartRect={beginRectZoneDrawing}
            onStartLasso={beginLassoZoneDrawing}
            onFinishLasso={finishLassoZone}
            onCancelDrawing={cancelZoneDrawing}
          />
          <section className="generation-settings">
            <h3>Generation Settings</h3>
            <label className="field-label" htmlFor="refine-strength">
              Refine Strength: {refineStrength.toFixed(2)}
            </label>
            <input
              id="refine-strength"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={refineStrength}
              onChange={(event) =>
                executeCommand(setRefineStrengthCommand(Number(event.target.value)))
              }
            />
          </section>
          <section className="generation-tools">
            <h3>Generation Jobs</h3>
            <p>
              Queue backend jobs. SKETCH and OBJECT_RENDER use selected object. ZONE_RENDER
              uses saved zones. REFINE applies a low-strength global pass.
            </p>
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
              <button
                type="button"
                className="button-link"
                onClick={() => void submitGenerationJob("ZONE_RENDER")}
                disabled={activeSubmission !== null || sceneSpec.zones.length === 0}
              >
                Generate Zones
              </button>
              <button
                type="button"
                className="button-link"
                onClick={() => void submitGenerationJob("REFINE")}
                disabled={activeSubmission !== null || !finalCompositeArtifactId}
              >
                Refine Composite
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
