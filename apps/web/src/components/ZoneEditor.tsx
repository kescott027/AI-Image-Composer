import { useEffect, useMemo, useState } from "react";

import type { SceneSpec } from "@ai-image-composer/shared";

import {
  removeZoneCommand,
  setZoneObjectInclusionCommand,
  setZoneSelectionModeCommand,
  updateZoneCommand,
  type SceneCommand,
} from "../state/commands";

export type ZoneDrawingMode = "NONE" | "RECT" | "LASSO";

interface ZoneEditorProps {
  sceneSpec: SceneSpec;
  executeCommand: (command: SceneCommand) => void;
  drawingMode: ZoneDrawingMode;
  pendingZoneName: string;
  pendingLassoPoints: Array<{ x: number; y: number }>;
  onZoneNameChange: (value: string) => void;
  onStartRect: () => void;
  onStartLasso: () => void;
  onFinishLasso: () => void;
  onCancelDrawing: () => void;
}

interface ZoneDraft {
  name: string;
  x: string;
  y: string;
  width: string;
  height: string;
  guidancePrompt: string;
  negativePrompt: string;
}

function toZoneDraft(zone: SceneSpec["zones"][number]): ZoneDraft {
  return {
    name: zone.name,
    x: String(zone.shape.x),
    y: String(zone.shape.y),
    width: String(zone.shape.width),
    height: String(zone.shape.height),
    guidancePrompt: zone.guidance_prompt ?? "",
    negativePrompt: zone.negative_prompt ?? "",
  };
}

function parseNumberOrFallback(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function ZoneEditor({
  sceneSpec,
  executeCommand,
  drawingMode,
  pendingZoneName,
  pendingLassoPoints,
  onZoneNameChange,
  onStartRect,
  onStartLasso,
  onFinishLasso,
  onCancelDrawing,
}: ZoneEditorProps) {
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft | null>(null);

  useEffect(() => {
    if (sceneSpec.zones.length === 0) {
      setActiveZoneId(null);
      setZoneDraft(null);
      return;
    }
    if (!activeZoneId || !sceneSpec.zones.some((zone) => zone.id === activeZoneId)) {
      setActiveZoneId(sceneSpec.zones[0]?.id ?? null);
    }
  }, [activeZoneId, sceneSpec.zones]);

  const activeZone = useMemo(
    () => sceneSpec.zones.find((zone) => zone.id === activeZoneId) ?? null,
    [activeZoneId, sceneSpec.zones],
  );

  useEffect(() => {
    if (!activeZone) {
      setZoneDraft(null);
      return;
    }
    setZoneDraft(toZoneDraft(activeZone));
  }, [activeZone]);

  const objectNameById = useMemo(
    () => new Map(sceneSpec.objects.map((object) => [object.id, object.name])),
    [sceneSpec.objects],
  );

  const applyZoneEdits = () => {
    if (!activeZone || !zoneDraft) {
      return;
    }
    executeCommand(
      updateZoneCommand(activeZone.id, {
        name: zoneDraft.name,
        x: parseNumberOrFallback(zoneDraft.x, activeZone.shape.x),
        y: parseNumberOrFallback(zoneDraft.y, activeZone.shape.y),
        width: parseNumberOrFallback(zoneDraft.width, activeZone.shape.width),
        height: parseNumberOrFallback(zoneDraft.height, activeZone.shape.height),
        guidancePrompt: zoneDraft.guidancePrompt,
        negativePrompt: zoneDraft.negativePrompt,
      }),
    );
  };

  return (
    <section className="zone-editor">
      <h3>Zones</h3>
      <p>Draw, edit, and assign object membership for each zone.</p>
      <label className="field-label" htmlFor="zone-name">
        New Zone Name
      </label>
      <input
        id="zone-name"
        className="text-input"
        value={pendingZoneName}
        onChange={(event) => onZoneNameChange(event.target.value)}
        placeholder="Zone name"
      />

      <div className="tool-row">
        <button
          type="button"
          className="button-link"
          onClick={onStartRect}
          disabled={drawingMode === "RECT"}
        >
          Draw Rect
        </button>
        <button
          type="button"
          className="button-link"
          onClick={onStartLasso}
          disabled={drawingMode === "LASSO"}
        >
          Draw Lasso
        </button>
        <button
          type="button"
          className="button-link"
          onClick={onCancelDrawing}
          disabled={drawingMode === "NONE"}
        >
          Cancel
        </button>
      </div>

      {drawingMode === "RECT" ? (
        <p className="zone-mode-help">Drag on canvas to place rectangle zone.</p>
      ) : null}
      {drawingMode === "LASSO" ? (
        <>
          <p className="zone-mode-help">
            Click points on canvas to trace zone. Use Finish when done.
          </p>
          <div className="tool-row">
            <button
              type="button"
              className="mini-button"
              onClick={onFinishLasso}
              disabled={pendingLassoPoints.length < 3}
            >
              Finish Lasso ({pendingLassoPoints.length})
            </button>
          </div>
        </>
      ) : null}

      {sceneSpec.zones.length === 0 ? (
        <p className="relation-empty">No zones defined.</p>
      ) : (
        <>
          <ul className="zone-list">
            {sceneSpec.zones.map((zone) => (
              <li
                key={zone.id}
                className={`zone-item ${zone.id === activeZoneId ? "is-active" : ""}`}
              >
                <button
                  type="button"
                  className="zone-select"
                  onClick={() => setActiveZoneId(zone.id)}
                >
                  {zone.name} ({zone.shape.type}) {Math.round(zone.shape.x)},
                  {Math.round(zone.shape.y)} / {Math.round(zone.shape.width)}x
                  {Math.round(zone.shape.height)}
                </button>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => executeCommand(removeZoneCommand(zone.id))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          {activeZone && zoneDraft ? (
            <div className="zone-edit-form">
              <h4>Edit {activeZone.name}</h4>
              <label className="field-label" htmlFor="zone-edit-name">
                Name
              </label>
              <input
                id="zone-edit-name"
                className="text-input"
                value={zoneDraft.name}
                onChange={(event) =>
                  setZoneDraft((current) =>
                    current ? { ...current, name: event.target.value } : current,
                  )
                }
              />
              <div className="zone-bounds-grid">
                <label className="field-label" htmlFor="zone-edit-x">
                  X
                </label>
                <input
                  id="zone-edit-x"
                  className="text-input"
                  value={zoneDraft.x}
                  onChange={(event) =>
                    setZoneDraft((current) =>
                      current ? { ...current, x: event.target.value } : current,
                    )
                  }
                />
                <label className="field-label" htmlFor="zone-edit-y">
                  Y
                </label>
                <input
                  id="zone-edit-y"
                  className="text-input"
                  value={zoneDraft.y}
                  onChange={(event) =>
                    setZoneDraft((current) =>
                      current ? { ...current, y: event.target.value } : current,
                    )
                  }
                />
                <label className="field-label" htmlFor="zone-edit-width">
                  Width
                </label>
                <input
                  id="zone-edit-width"
                  className="text-input"
                  value={zoneDraft.width}
                  onChange={(event) =>
                    setZoneDraft((current) =>
                      current ? { ...current, width: event.target.value } : current,
                    )
                  }
                />
                <label className="field-label" htmlFor="zone-edit-height">
                  Height
                </label>
                <input
                  id="zone-edit-height"
                  className="text-input"
                  value={zoneDraft.height}
                  onChange={(event) =>
                    setZoneDraft((current) =>
                      current ? { ...current, height: event.target.value } : current,
                    )
                  }
                />
              </div>

              <label className="field-label" htmlFor="zone-guidance-prompt">
                Guidance Prompt
              </label>
              <textarea
                id="zone-guidance-prompt"
                className="prompt-input"
                value={zoneDraft.guidancePrompt}
                onChange={(event) =>
                  setZoneDraft((current) =>
                    current ? { ...current, guidancePrompt: event.target.value } : current,
                  )
                }
              />

              <label className="field-label" htmlFor="zone-negative-prompt">
                Negative Prompt
              </label>
              <textarea
                id="zone-negative-prompt"
                className="prompt-input"
                value={zoneDraft.negativePrompt}
                onChange={(event) =>
                  setZoneDraft((current) =>
                    current ? { ...current, negativePrompt: event.target.value } : current,
                  )
                }
              />

              <div className="tool-row">
                <button type="button" className="button-link" onClick={applyZoneEdits}>
                  Apply Zone Edits
                </button>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() =>
                    executeCommand(
                      setZoneSelectionModeCommand(
                        activeZone.id,
                        activeZone.selection_mode === "MANUAL" ? "AUTO" : "MANUAL",
                      ),
                    )
                  }
                >
                  Selection: {activeZone.selection_mode === "MANUAL" ? "Manual" : "Auto"}
                </button>
              </div>

              <div className="zone-membership">
                <p className="zone-mode-help">
                  Included: {activeZone.included_object_ids.length} object(s)
                </p>
                {sceneSpec.objects.length === 0 ? (
                  <p className="relation-empty">No objects available for this zone.</p>
                ) : (
                  <ul className="zone-membership-list">
                    {sceneSpec.objects.map((object) => {
                      const checked = activeZone.included_object_ids.includes(object.id);
                      const disabled = activeZone.selection_mode !== "MANUAL";
                      return (
                        <li key={`${activeZone.id}_${object.id}`} className="zone-membership-item">
                          <label>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={(event) =>
                                executeCommand(
                                  setZoneObjectInclusionCommand(
                                    activeZone.id,
                                    object.id,
                                    event.target.checked,
                                  ),
                                )
                              }
                            />
                            {objectNameById.get(object.id) ?? object.id}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
