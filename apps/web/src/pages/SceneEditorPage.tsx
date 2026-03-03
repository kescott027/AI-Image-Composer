import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { SceneSpec } from "@ai-image-composer/shared";

import { buildGenerationInput, createJob, type JobRead, type SupportedJobType } from "../api/jobs";
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
import {
  ObjectPromptEditor,
  type ObjectPromptEditorValues,
} from "../components/ObjectPromptEditor";
import {
  type OverarchingPromptEditorValues,
  OverarchingPromptEditor,
} from "../components/OverarchingPromptEditor";
import { RelationsEditor } from "../components/RelationsEditor";
import { SceneCanvas } from "../components/SceneCanvas";
import { type ZoneDrawingMode, ZoneEditor } from "../components/ZoneEditor";
import { ROUTES } from "../routes";
import {
  mapLatestBlockingSketchArtifactId,
  mapLatestFinalCompositeArtifactId,
  mapLatestObjectRenderArtifactsByObjectId,
  mapLatestSketchArtifactsByObjectId,
  mapRecentSuccessfulArtifacts,
  mapSketchArtifactCandidatesByObjectId,
} from "../state/jobArtifacts";
import {
  addLayerCommand,
  addObjectCommand,
  addZoneLassoCommand,
  addZoneRectCommand,
  duplicateObjectCommand,
  moveObjectCommand,
  moveObjectZOrderCommand,
  removeObjectCommand,
  renameObjectCommand,
  rotateObjectCommand,
  setHarmonizationStrengthCommand,
  setLightingProfileCommand,
  setPalettePresetCommand,
  setRefineStrengthCommand,
  scaleObjectCommand,
  setNegativePromptCommand,
  setObjectNegativePromptCommand,
  setObjectAnchoredCommand,
  setObjectPreferredWireframeCommand,
  setObjectPromptCommand,
  setOverarchingPromptCommand,
  setStylePresetCommand,
} from "../state/commands";
import { SceneStoreProvider, useSceneStore } from "../state/sceneStore";

const OBJECT_PRESETS = [
  {
    id: "person",
    label: "Person",
    name: "Person",
    kind: "person",
    prompt: "A person standing naturally, facing camera, clean silhouette",
    width: 140,
    height: 260,
  },
  {
    id: "table",
    label: "Table",
    name: "Table",
    kind: "prop",
    prompt: "A wooden table, three-quarter view, clean silhouette",
    width: 220,
    height: 140,
  },
  {
    id: "birthday_cake",
    label: "Birthday Cake",
    name: "Birthday Cake",
    kind: "prop",
    prompt: "A birthday cake with candles, clean silhouette",
    width: 120,
    height: 120,
  },
] as const;

const PALETTE_PRESETS = [
  { value: "balanced_warm", label: "Balanced Warm" },
  { value: "vibrant_pop", label: "Vibrant Pop" },
  { value: "muted_cinematic", label: "Muted Cinematic" },
  { value: "pastel_soft", label: "Pastel Soft" },
  { value: "nocturne_cool", label: "Nocturne Cool" },
] as const;

const LIGHTING_PROFILES = [
  { value: "soft_indoor", label: "Soft Indoor" },
  { value: "golden_hour", label: "Golden Hour" },
  { value: "studio_even", label: "Studio Even" },
  { value: "night_neon", label: "Night Neon" },
] as const;

function createObjectId() {
  return `obj_${Math.random().toString(36).slice(2, 10)}`;
}

function createLayerId() {
  return `layer_${Math.random().toString(36).slice(2, 10)}`;
}

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
  const [pendingLassoPoints, setPendingLassoPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [wireframeCycleCount, setWireframeCycleCount] = useState(3);
  const [wireframeVariantCount, setWireframeVariantCount] = useState(4);
  const [isHydratedFromApi, setIsHydratedFromApi] = useState(false);
  const [isLoadingScene, setIsLoadingScene] = useState(true);
  const [isPersistingScene, setIsPersistingScene] = useState(false);
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [objectNameDraft, setObjectNameDraft] = useState("");

  const autosaveSkipRef = useRef(true);
  const latestSceneSpecRef = useRef<SceneSpec | null>(null);

  const { sceneSpec, commandLog, canUndo, canRedo, executeCommand, undo, redo, loadSceneSpec } =
    useSceneStore();

  const objectLayer = useMemo(
    () => sceneSpec.layers.find((layer) => layer.type === "OBJECT"),
    [sceneSpec.layers],
  );
  const selectedObject = useMemo(
    () => sceneSpec.objects.find((object) => object.id === selectedObjectId) ?? null,
    [sceneSpec.objects, selectedObjectId],
  );

  const preferredWireframeArtifactsByObjectId = useMemo(
    () =>
      Object.fromEntries(
        sceneSpec.objects
          .map((object) => {
            const artifactId = object.metadata?.preferred_wireframe_artifact_id;
            if (typeof artifactId !== "string" || artifactId.length === 0) {
              return null;
            }
            return [object.id, artifactId] as const;
          })
          .filter((entry): entry is readonly [string, string] => Boolean(entry)),
      ),
    [sceneSpec.objects],
  );

  const wireframeArtifactsByObjectId = useMemo(
    () => ({
      ...mapLatestSketchArtifactsByObjectId(sceneJobs),
      ...preferredWireframeArtifactsByObjectId,
    }),
    [sceneJobs, preferredWireframeArtifactsByObjectId],
  );
  const sketchCandidatesByObjectId = useMemo(
    () => mapSketchArtifactCandidatesByObjectId(sceneJobs, 8),
    [sceneJobs],
  );
  const selectedObjectSketchCandidates = useMemo(() => {
    if (!selectedObjectId) {
      return [];
    }
    return sketchCandidatesByObjectId[selectedObjectId] ?? [];
  }, [selectedObjectId, sketchCandidatesByObjectId]);
  const objectRenderArtifactsByObjectId = useMemo(
    () => mapLatestObjectRenderArtifactsByObjectId(sceneJobs),
    [sceneJobs],
  );
  const blockingArtifactId = useMemo(
    () => mapLatestBlockingSketchArtifactId(sceneJobs),
    [sceneJobs],
  );
  const finalCompositeArtifactId = useMemo(
    () => mapLatestFinalCompositeArtifactId(sceneJobs),
    [sceneJobs],
  );
  const recentArtifacts = useMemo(() => mapRecentSuccessfulArtifacts(sceneJobs, 10), [sceneJobs]);
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
  const renderOrderedObjects = useMemo(() => {
    const visibleObjectLayerIds = new Set(
      sceneSpec.layers
        .filter((layer) => layer.visible && layer.type === "OBJECT")
        .map((layer) => layer.id),
    );
    const layerOrder = new Map(sceneSpec.layers.map((layer) => [layer.id, layer.order]));

    return [...sceneSpec.objects]
      .filter((object) => visibleObjectLayerIds.has(object.layer_id))
      .sort((left, right) => {
        const leftLayerOrder = layerOrder.get(left.layer_id) ?? 0;
        const rightLayerOrder = layerOrder.get(right.layer_id) ?? 0;
        if (leftLayerOrder !== rightLayerOrder) {
          return leftLayerOrder - rightLayerOrder;
        }
        return (left.transform?.z_index ?? 0) - (right.transform?.z_index ?? 0);
      });
  }, [sceneSpec.layers, sceneSpec.objects]);
  const unanchoredRenderableObjects = useMemo(
    () => renderOrderedObjects.filter((object) => object.metadata?.anchored !== true),
    [renderOrderedObjects],
  );
  const latestObjectRenderJobByObjectId = useMemo(() => {
    const latestByObjectId = new Map<string, JobRead>();
    sceneJobs.forEach((job) => {
      if (job.job_type !== "OBJECT_RENDER") {
        return;
      }
      const targetObjectId = job.input.target_object_id;
      if (typeof targetObjectId !== "string" || targetObjectId.length === 0) {
        return;
      }
      const existing = latestByObjectId.get(targetObjectId);
      const currentCreatedAtMs = job.created_at ? Date.parse(job.created_at) : 0;
      const existingCreatedAtMs = existing?.created_at ? Date.parse(existing.created_at) : -1;
      if (!existing || currentCreatedAtMs >= existingCreatedAtMs) {
        latestByObjectId.set(targetObjectId, job);
      }
    });
    return latestByObjectId;
  }, [sceneJobs]);
  const renderProgress = useMemo(() => {
    const total = renderOrderedObjects.length;
    let succeeded = 0;
    let running = 0;
    let queued = 0;
    let failed = 0;
    let missing = 0;

    renderOrderedObjects.forEach((object) => {
      const job = latestObjectRenderJobByObjectId.get(object.id);
      if (!job) {
        missing += 1;
        return;
      }
      if (job.status === "SUCCEEDED") {
        succeeded += 1;
      } else if (job.status === "RUNNING") {
        running += 1;
      } else if (job.status === "QUEUED") {
        queued += 1;
      } else if (job.status === "FAILED") {
        failed += 1;
      } else {
        missing += 1;
      }
    });

    return { total, succeeded, running, queued, failed, missing };
  }, [latestObjectRenderJobByObjectId, renderOrderedObjects]);
  const objectsWithWireframeCount = useMemo(
    () =>
      renderOrderedObjects.filter(
        (object) =>
          Boolean(preferredWireframeArtifactsByObjectId[object.id]) ||
          Boolean(wireframeArtifactsByObjectId[object.id]),
      ).length,
    [preferredWireframeArtifactsByObjectId, renderOrderedObjects, wireframeArtifactsByObjectId],
  );
  const anchoredObjectCount = useMemo(
    () => renderOrderedObjects.filter((object) => object.metadata?.anchored === true).length,
    [renderOrderedObjects],
  );
  const flowChecklist = useMemo(
    () => [
      {
        id: "prompt",
        label: "Overarching prompt set",
        done: sceneSpec.scene.overarching_prompt.trim().length > 0,
      },
      {
        id: "blocking",
        label: "Blocking layer generated",
        done: Boolean(blockingArtifactId),
      },
      {
        id: "objects",
        label: "At least 3 objects staged",
        done: renderOrderedObjects.length >= 3,
      },
      {
        id: "wireframes",
        label: "Wireframes selected/generated for staged objects",
        done:
          renderOrderedObjects.length > 0 &&
          objectsWithWireframeCount === renderOrderedObjects.length,
      },
      {
        id: "anchors",
        label: "All staged objects anchored",
        done:
          renderOrderedObjects.length > 0 && anchoredObjectCount === renderOrderedObjects.length,
      },
      {
        id: "composite",
        label: "Composite/refine output generated",
        done: Boolean(finalCompositeArtifactId),
      },
    ],
    [
      anchoredObjectCount,
      blockingArtifactId,
      finalCompositeArtifactId,
      objectsWithWireframeCount,
      renderOrderedObjects.length,
      sceneSpec.scene.overarching_prompt,
    ],
  );
  const completedChecklistCount = useMemo(
    () => flowChecklist.filter((item) => item.done).length,
    [flowChecklist],
  );
  const persistFeedbackTone = useMemo(() => {
    const text = persistMessage.toLowerCase();
    if (text.includes("failed")) {
      return "error";
    }
    if (text.includes("saving")) {
      return "info";
    }
    if (text.includes("saved")) {
      return "success";
    }
    return "info";
  }, [persistMessage]);
  const jobFeedbackTone = useMemo(() => {
    const text = jobFeedback.toLowerCase();
    if (text.includes("failed") || text.includes("error")) {
      return "error";
    }
    if (
      text.includes("select ") ||
      text.includes("no ") ||
      text.includes("anchor all") ||
      text.includes("missing")
    ) {
      return "warning";
    }
    if (
      text.includes("queued") ||
      text.includes("selected") ||
      text.includes("anchored") ||
      text.includes("completed")
    ) {
      return "success";
    }
    return "info";
  }, [jobFeedback]);

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
    executeCommand(
      addZoneRectCommand(
        pendingZoneName || `Zone ${sceneSpec.zones.length + 1}`,
        zone.x,
        zone.y,
        zone.width,
        zone.height,
      ),
    );
    setZoneDrawingMode("NONE");
  };

  const appendLassoPoint = (point: { x: number; y: number }) => {
    setPendingLassoPoints((current) => [...current, point]);
  };

  const finishLassoZone = () => {
    if (pendingLassoPoints.length < 3) {
      return;
    }
    executeCommand(
      addZoneLassoCommand(
        pendingZoneName || `Zone ${sceneSpec.zones.length + 1}`,
        pendingLassoPoints,
      ),
    );
    setPendingLassoPoints([]);
    setZoneDrawingMode("NONE");
  };

  const refineStrength = sceneSpec.settings.defaults.refine_strength ?? 0.25;
  const palettePreset = sceneSpec.settings.defaults.palette_preset ?? "balanced_warm";
  const lightingProfile = sceneSpec.settings.defaults.lighting_profile ?? "soft_indoor";
  const harmonizationStrength = sceneSpec.settings.defaults.harmonization_strength ?? 0.6;

  const addObject = () => {
    if (!objectLayer) {
      return;
    }
    executeCommand(addObjectCommand(objectLayer.id, `Object ${sceneSpec.objects.length + 1}`));
  };

  const addPresetObject = (preset: (typeof OBJECT_PRESETS)[number]) => {
    if (!objectLayer) {
      return;
    }
    const layerId = createLayerId();
    const objectId = createObjectId();
    executeCommand(addLayerCommand(`${preset.label} Layer`, "OBJECT", { layerId }));
    executeCommand(
      addObjectCommand(layerId, preset.name, {
        objectId,
        kind: preset.kind,
        prompt: preset.prompt,
        width: preset.width,
        height: preset.height,
      }),
    );
    setSelectedObjectId(objectId);
    setJobFeedback(
      `${preset.label} added on its own layer. Generate wireframe to place and anchor it in the scene.`,
    );
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
    if (selectedObject.metadata?.anchored) {
      setJobFeedback(`${selectedObject.name} is anchored. Unanchor to move.`);
      return;
    }
    executeCommand(moveObjectCommand(selectedObject.id, deltaX, deltaY));
  };

  const applyRotate = (deltaDeg: number) => {
    if (!selectedObject) {
      return;
    }
    if (selectedObject.metadata?.anchored) {
      setJobFeedback(`${selectedObject.name} is anchored. Unanchor to rotate.`);
      return;
    }
    executeCommand(rotateObjectCommand(selectedObject.id, deltaDeg));
  };

  const applyScale = (multiplier: number) => {
    if (!selectedObject) {
      return;
    }
    if (selectedObject.metadata?.anchored) {
      setJobFeedback(`${selectedObject.name} is anchored. Unanchor to scale.`);
      return;
    }
    executeCommand(scaleObjectCommand(selectedObject.id, multiplier));
  };

  const toggleAnchor = () => {
    if (!selectedObject) {
      return;
    }
    const anchored = selectedObject.metadata?.anchored === true;
    executeCommand(setObjectAnchoredCommand(selectedObject.id, !anchored));
    setJobFeedback(
      !anchored
        ? `${selectedObject.name} anchored in place.`
        : `${selectedObject.name} unanchored and movable.`,
    );
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

  const queueGenerationJob = async (
    jobType: SupportedJobType,
    inputOptions?: {
      targetObjectId?: string;
      sourceArtifactId?: string;
      wireframeArtifactId?: string;
      generationMode?: "OBJECT" | "BLOCKING";
    },
  ) => {
    const input = buildGenerationInput(sceneSpec, inputOptions);
    return createJob({
      scene_id: sceneSpec.scene.id,
      job_type: jobType,
      input,
    });
  };

  const submitGenerationJob = async (
    jobType: SupportedJobType,
    options?: { allowSceneSketch?: boolean; targetObjectId?: string },
  ) => {
    const selectedTargetObjectId = options?.targetObjectId ?? selectedObject?.id;
    if (jobType === "SKETCH" && !options?.allowSceneSketch && !selectedTargetObjectId) {
      setJobFeedback("Select an object before submitting a SKETCH job.");
      return;
    }
    if (jobType === "OBJECT_RENDER" && !selectedTargetObjectId) {
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
      const inputOptions: {
        targetObjectId?: string;
        sourceArtifactId?: string;
        wireframeArtifactId?: string;
        generationMode?: "OBJECT" | "BLOCKING";
      } = {};
      if (jobType === "SKETCH") {
        if (selectedTargetObjectId) {
          inputOptions.targetObjectId = selectedTargetObjectId;
          inputOptions.generationMode = "OBJECT";
        } else {
          inputOptions.generationMode = "BLOCKING";
        }
      }
      if (jobType === "OBJECT_RENDER" && selectedTargetObjectId) {
        inputOptions.targetObjectId = selectedTargetObjectId;
        inputOptions.wireframeArtifactId =
          preferredWireframeArtifactsByObjectId[selectedTargetObjectId] ??
          wireframeArtifactsByObjectId[selectedTargetObjectId];
      }
      if (jobType === "REFINE" && finalCompositeArtifactId) {
        inputOptions.sourceArtifactId = finalCompositeArtifactId;
      }
      const job = await queueGenerationJob(jobType, inputOptions);
      setJobFeedback(`Queued ${job.job_type} as ${job.id} (status: ${job.status}).`);
      setPersistMessage("Scene snapshot persisted for queued job.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown job submission error";
      setJobFeedback(`Job submission failed: ${message}`);
    } finally {
      setActiveSubmission(null);
    }
  };

  const generateBlockingLayer = async () => {
    await submitGenerationJob("SKETCH", { allowSceneSketch: true });
  };

  const generateWireframeCycle = async () => {
    if (!selectedObject) {
      setJobFeedback("Select an object before cycling wireframe generation.");
      return;
    }
    const count = Math.min(5, Math.max(2, wireframeCycleCount));
    setActiveSubmission("SKETCH");
    setJobFeedback(`Generating ${count} wireframe passes for ${selectedObject.name}...`);
    try {
      await upsertSceneSpec(sceneId, sceneSpec);
      const queued: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const job = await queueGenerationJob("SKETCH", {
          targetObjectId: selectedObject.id,
          generationMode: "OBJECT",
        });
        queued.push(job.id);
      }
      setJobFeedback(`Queued ${queued.length} wireframe cycles for ${selectedObject.name}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown wireframe cycle error";
      setJobFeedback(`Wireframe cycle failed: ${message}`);
    } finally {
      setActiveSubmission(null);
    }
  };

  const generateWireframeVariants = async () => {
    if (!selectedObject) {
      setJobFeedback("Select an object before generating wireframe variants.");
      return;
    }
    const count = Math.min(8, Math.max(1, wireframeVariantCount));
    setActiveSubmission("SKETCH");
    setJobFeedback(`Generating ${count} wireframe variants for ${selectedObject.name}...`);
    try {
      await upsertSceneSpec(sceneId, sceneSpec);
      for (let index = 0; index < count; index += 1) {
        await queueGenerationJob("SKETCH", {
          targetObjectId: selectedObject.id,
          generationMode: "OBJECT",
        });
      }
      setJobFeedback(`Queued ${count} wireframe variants for ${selectedObject.name}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown wireframe variant error";
      setJobFeedback(`Variant generation failed: ${message}`);
    } finally {
      setActiveSubmission(null);
    }
  };

  const chooseWireframeCandidate = (artifactId: string) => {
    if (!selectedObject) {
      return;
    }
    executeCommand(setObjectPreferredWireframeCommand(selectedObject.id, artifactId));
    setJobFeedback(`Selected wireframe candidate ${artifactId} for ${selectedObject.name}.`);
  };

  const clearPreferredWireframeCandidate = () => {
    if (!selectedObject) {
      return;
    }
    executeCommand(setObjectPreferredWireframeCommand(selectedObject.id, null));
    setJobFeedback("Wireframe candidate reset to latest successful sketch.");
  };

  const queueOrderedRenderPipeline = async (includeRefine: boolean) => {
    if (renderOrderedObjects.length === 0) {
      setJobFeedback("No visible objects to render.");
      return;
    }
    if (unanchoredRenderableObjects.length > 0) {
      setJobFeedback(
        `Anchor all objects before full render. Unanchored: ${unanchoredRenderableObjects
          .map((object) => object.name)
          .join(", ")}`,
      );
      return;
    }
    const missingWireframeObjects = renderOrderedObjects.filter((object) => {
      const wireframeArtifactId =
        preferredWireframeArtifactsByObjectId[object.id] ?? wireframeArtifactsByObjectId[object.id];
      return !wireframeArtifactId;
    });
    if (missingWireframeObjects.length > 0) {
      setJobFeedback(
        `Generate or choose wireframes before full render. Missing: ${missingWireframeObjects
          .map((object) => object.name)
          .join(", ")}`,
      );
      return;
    }
    setActiveSubmission("OBJECT_RENDER");
    setJobFeedback(
      includeRefine
        ? "Queueing bottom-to-top object renders, composite, and refine..."
        : "Queueing bottom-to-top object renders, then composite...",
    );
    try {
      await upsertSceneSpec(sceneId, sceneSpec);
      for (const object of renderOrderedObjects) {
        await queueGenerationJob("OBJECT_RENDER", {
          targetObjectId: object.id,
          wireframeArtifactId:
            preferredWireframeArtifactsByObjectId[object.id] ??
            wireframeArtifactsByObjectId[object.id],
          generationMode: "OBJECT",
        });
      }
      await queueGenerationJob("FINAL_COMPOSITE");
      if (includeRefine) {
        await queueGenerationJob("REFINE");
      }
      setJobFeedback(
        includeRefine
          ? `Queued ${renderOrderedObjects.length} object render job(s) + composite + refine.`
          : `Queued ${renderOrderedObjects.length} object render job(s) in layer order + final composite.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown layered render error";
      setJobFeedback(`Layered render queue failed: ${message}`);
    } finally {
      setActiveSubmission(null);
    }
  };

  const renderOrderedLayersAndComposite = async () => {
    await queueOrderedRenderPipeline(false);
  };

  const renderOrderedLayersCompositeAndRefine = async () => {
    await queueOrderedRenderPipeline(true);
  };

  const retryFailedObjectRenders = async () => {
    const failedObjects = renderOrderedObjects.filter(
      (object) => latestObjectRenderJobByObjectId.get(object.id)?.status === "FAILED",
    );
    if (failedObjects.length === 0) {
      setJobFeedback("No failed object renders to retry.");
      return;
    }

    setActiveSubmission("OBJECT_RENDER");
    setJobFeedback(`Retrying ${failedObjects.length} failed object render(s)...`);
    try {
      await upsertSceneSpec(sceneId, sceneSpec);
      for (const object of failedObjects) {
        await queueGenerationJob("OBJECT_RENDER", {
          targetObjectId: object.id,
          wireframeArtifactId:
            preferredWireframeArtifactsByObjectId[object.id] ??
            wireframeArtifactsByObjectId[object.id],
          generationMode: "OBJECT",
        });
      }
      setJobFeedback(`Queued ${failedObjects.length} object render retry job(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown object retry error";
      setJobFeedback(`Retry failed: ${message}`);
    } finally {
      setActiveSubmission(null);
    }
  };

  const formatArtifactCaption = (artifact: (typeof recentArtifacts)[number]) => {
    const target = artifact.targetObjectId ? ` · ${artifact.targetObjectId}` : "";
    return `${artifact.jobType}${target}`;
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
          <button
            type="button"
            className="button-link"
            onClick={() => void saveScene()}
            disabled={isPersistingScene}
          >
            Save Scene
          </button>
          <button
            type="button"
            className="button-link"
            onClick={() => void saveVersion()}
            disabled={isSavingVersion || isLoadingScene}
          >
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
          blockingArtifactId={blockingArtifactId}
          wireframeArtifactsByObjectId={wireframeArtifactsByObjectId}
          objectRenderArtifactsByObjectId={objectRenderArtifactsByObjectId}
          finalCompositeArtifactId={showFinalComposite ? finalCompositeArtifactId : null}
          zoneDrawingMode={zoneDrawingMode}
          pendingLassoPoints={pendingLassoPoints}
          onCreateRectZone={createRectZone}
          onAddLassoPoint={appendLassoPoint}
          onMoveObject={(objectId, deltaX, deltaY) =>
            executeCommand(moveObjectCommand(objectId, deltaX, deltaY))
          }
          onSelectObject={setSelectedObjectId}
        />

        <aside className="panel panel-right">
          <h2>Right Panel</h2>
          <p>Prompt, constraints, generation, and version history</p>
          <p className={`generation-status status-${persistFeedbackTone}`}>{persistMessage}</p>
          <OverarchingPromptEditor scene={sceneSpec.scene} onApply={applyScenePrompt} />
          <section className="object-tools">
            <h3>Object Creation</h3>
            <div className="tool-row">
              <button
                type="button"
                className="button-link"
                onClick={addObject}
                disabled={!objectLayer}
              >
                Add Generic Object
              </button>
            </div>
            <div className="tool-row">
              {OBJECT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="mini-button"
                  onClick={() => addPresetObject(preset)}
                  disabled={!objectLayer}
                >
                  + {preset.label}
                </button>
              ))}
            </div>
          </section>
          <div className="object-tools">
            <h3>Object Transform</h3>
            <p>
              {selectedObject ? `Selected: ${selectedObject.name}` : "Select an object in canvas."}
            </p>
            <div className="tool-row">
              <button
                type="button"
                className="mini-button"
                onClick={() => applyMove(-12, 0)}
                disabled={!selectedObject}
              >
                Left
              </button>
              <button
                type="button"
                className="mini-button"
                onClick={() => applyMove(12, 0)}
                disabled={!selectedObject}
              >
                Right
              </button>
              <button
                type="button"
                className="mini-button"
                onClick={() => applyMove(0, -12)}
                disabled={!selectedObject}
              >
                Up
              </button>
              <button
                type="button"
                className="mini-button"
                onClick={() => applyMove(0, 12)}
                disabled={!selectedObject}
              >
                Down
              </button>
            </div>
            <div className="tool-row">
              <button
                type="button"
                className="mini-button"
                onClick={() => applyRotate(-15)}
                disabled={!selectedObject}
              >
                Rotate -15
              </button>
              <button
                type="button"
                className="mini-button"
                onClick={() => applyRotate(15)}
                disabled={!selectedObject}
              >
                Rotate +15
              </button>
              <button
                type="button"
                className="mini-button"
                onClick={() => applyScale(0.9)}
                disabled={!selectedObject}
              >
                Scale -10%
              </button>
              <button
                type="button"
                className="mini-button"
                onClick={() => applyScale(1.1)}
                disabled={!selectedObject}
              >
                Scale +10%
              </button>
            </div>
            <div className="tool-row">
              <button
                type="button"
                className="mini-button"
                onClick={() => applyZOrder("DOWN")}
                disabled={!selectedObject}
              >
                Send Back
              </button>
              <button
                type="button"
                className="mini-button"
                onClick={() => applyZOrder("UP")}
                disabled={!selectedObject}
              >
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
              <button
                type="button"
                className="mini-button"
                onClick={applyObjectRename}
                disabled={!selectedObject || !objectNameDraft.trim()}
              >
                Rename
              </button>
              <button
                type="button"
                className="mini-button"
                onClick={duplicateSelectedObject}
                disabled={!selectedObject}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="mini-button"
                onClick={removeSelectedObject}
                disabled={!selectedObject}
              >
                Delete
              </button>
              <button
                type="button"
                className="mini-button"
                onClick={toggleAnchor}
                disabled={!selectedObject}
              >
                {selectedObject?.metadata?.anchored ? "Unanchor" : "Anchor"}
              </button>
            </div>
            <p className="shortcut-hint">
              Shortcuts: Cmd/Ctrl+Z Undo, Cmd/Ctrl+Shift+Z Redo, Cmd/Ctrl+D Duplicate, Del Remove,
              Arrows Move, Shift+Arrows Fast Move.
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
            <label className="field-label" htmlFor="palette-preset">
              Palette Preset
            </label>
            <select
              id="palette-preset"
              className="prompt-select"
              value={palettePreset}
              onChange={(event) => executeCommand(setPalettePresetCommand(event.target.value))}
            >
              {PALETTE_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
            <label className="field-label" htmlFor="lighting-profile">
              Lighting Profile
            </label>
            <select
              id="lighting-profile"
              className="prompt-select"
              value={lightingProfile}
              onChange={(event) => executeCommand(setLightingProfileCommand(event.target.value))}
            >
              {LIGHTING_PROFILES.map((profile) => (
                <option key={profile.value} value={profile.value}>
                  {profile.label}
                </option>
              ))}
            </select>
            <label className="field-label" htmlFor="harmonization-strength">
              Harmonization Strength: {harmonizationStrength.toFixed(2)}
            </label>
            <input
              id="harmonization-strength"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={harmonizationStrength}
              onChange={(event) =>
                executeCommand(setHarmonizationStrengthCommand(Number(event.target.value)))
              }
            />
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
              Blocking pass uses scene prompt. SKETCH/OBJECT_RENDER use selected object.
              OBJECT_RENDER jobs can be queued in full layer order for end-to-end composition.
            </p>
            <section className="flow-readiness">
              <h4>Release 0.5 Readiness</h4>
              <p className="flow-summary">
                {completedChecklistCount}/{flowChecklist.length} steps complete
              </p>
              <ul className="flow-checklist">
                {flowChecklist.map((item) => (
                  <li key={item.id} className={`flow-check-item ${item.done ? "done" : "todo"}`}>
                    <span className="flow-check-state">{item.done ? "Done" : "Pending"}</span>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </section>
            <div className="tool-row">
              <button
                type="button"
                className="button-link"
                onClick={() => void generateBlockingLayer()}
                disabled={activeSubmission !== null}
              >
                Generate Blocking Layer
              </button>
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
                onClick={() => void renderOrderedLayersAndComposite()}
                disabled={activeSubmission !== null || renderOrderedObjects.length === 0}
              >
                Render All Layers + Composite
              </button>
              <button
                type="button"
                className="button-link"
                onClick={() => void renderOrderedLayersCompositeAndRefine()}
                disabled={activeSubmission !== null || renderOrderedObjects.length === 0}
              >
                Render Full Scene + Refine
              </button>
            </div>
            <div className="tool-row">
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
              <button
                type="button"
                className="mini-button"
                onClick={() => void submitGenerationJob("FINAL_COMPOSITE")}
                disabled={activeSubmission !== null}
              >
                Composite Only
              </button>
            </div>
            <div className="tool-row">
              <label className="field-label" htmlFor="wireframe-cycle-count">
                Cycle Count (2-5)
              </label>
              <input
                id="wireframe-cycle-count"
                className="text-input"
                type="number"
                min={2}
                max={5}
                value={wireframeCycleCount}
                onChange={(event) => setWireframeCycleCount(Number(event.target.value))}
              />
              <button
                type="button"
                className="mini-button"
                onClick={() => void generateWireframeCycle()}
                disabled={activeSubmission !== null || !selectedObject}
              >
                Cycle Wireframe
              </button>
            </div>
            <div className="tool-row">
              <label className="field-label" htmlFor="wireframe-variant-count">
                Variant Count
              </label>
              <input
                id="wireframe-variant-count"
                className="text-input"
                type="number"
                min={1}
                max={8}
                value={wireframeVariantCount}
                onChange={(event) => setWireframeVariantCount(Number(event.target.value))}
              />
              <button
                type="button"
                className="mini-button"
                onClick={() => void generateWireframeVariants()}
                disabled={activeSubmission !== null || !selectedObject}
              >
                Generate N Variants
              </button>
              <button
                type="button"
                className="mini-button"
                onClick={clearPreferredWireframeCandidate}
                disabled={
                  !selectedObject || !preferredWireframeArtifactsByObjectId[selectedObject.id]
                }
              >
                Use Latest
              </button>
            </div>
            {selectedObject ? (
              <div className="artifact-gallery-panel">
                <h4>Wireframe Candidates ({selectedObject.name})</h4>
                {selectedObjectSketchCandidates.length === 0 ? (
                  <p className="job-empty">No sketch candidates yet.</p>
                ) : (
                  <ul className="artifact-gallery-list">
                    {selectedObjectSketchCandidates.map((artifactId) => (
                      <li key={`candidate_${artifactId}`} className="artifact-gallery-item">
                        <a
                          href={`/api/artifacts/${artifactId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="artifact-gallery-thumb-link"
                        >
                          <img
                            src={`/api/artifacts/${artifactId}`}
                            alt={`Wireframe candidate ${artifactId}`}
                            className="artifact-gallery-thumb"
                            loading="lazy"
                          />
                        </a>
                        <div className="artifact-gallery-meta">
                          <p className="artifact-gallery-title">{artifactId}</p>
                          <button
                            type="button"
                            className="mini-button"
                            onClick={() => chooseWireframeCandidate(artifactId)}
                          >
                            Use Candidate
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
            <section className="scene-versions-panel">
              <h4>Layer Render Progress</h4>
              <p>
                {renderProgress.succeeded}/{renderProgress.total} succeeded ·
                {` queued ${renderProgress.queued} · running ${renderProgress.running} · failed ${renderProgress.failed} · pending ${renderProgress.missing}`}
              </p>
              <div className="tool-row">
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => void retryFailedObjectRenders()}
                  disabled={activeSubmission !== null || renderProgress.failed === 0}
                >
                  Retry Failed Object Renders
                </button>
              </div>
            </section>
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
            <p className={`generation-status status-${jobFeedbackTone}`}>{jobFeedback}</p>
            <p className="generation-status">
              Latest blocking pass: {blockingArtifactId ?? "none"}
            </p>
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
                      v{version.version_number}{" "}
                      {version.created_at
                        ? `(${new Date(version.created_at).toLocaleString()})`
                        : ""}
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
          <section className="artifact-gallery-panel">
            <h3>Recent Artifacts</h3>
            {recentArtifacts.length === 0 ? (
              <p className="job-empty">No successful artifact outputs yet.</p>
            ) : (
              <ul className="artifact-gallery-list">
                {recentArtifacts.map((artifact) => (
                  <li
                    key={`${artifact.jobId}:${artifact.artifactId}`}
                    className="artifact-gallery-item"
                  >
                    <a
                      href={`/api/artifacts/${artifact.artifactId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="artifact-gallery-thumb-link"
                    >
                      <img
                        src={`/api/artifacts/${artifact.artifactId}`}
                        alt={`Artifact ${artifact.artifactId}`}
                        className="artifact-gallery-thumb"
                        loading="lazy"
                      />
                    </a>
                    <div className="artifact-gallery-meta">
                      <p className="artifact-gallery-title">{formatArtifactCaption(artifact)}</p>
                      <p className="artifact-gallery-subtitle">
                        {artifact.createdAt
                          ? new Date(artifact.createdAt).toLocaleTimeString()
                          : "time unknown"}
                      </p>
                      <a
                        href={`/api/artifacts/${artifact.artifactId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mini-button"
                      >
                        Open Artifact
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <JobStatusPanel sceneId={sceneSpec.scene.id} onJobsUpdate={setSceneJobs} />
          <ul className="history-list">
            {commandLog
              .slice(-6)
              .reverse()
              .map((entry, index) => (
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
