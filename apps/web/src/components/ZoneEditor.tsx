import type { SceneSpec } from "@ai-image-composer/shared";

import { removeZoneCommand, type SceneCommand } from "../state/commands";

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
  return (
    <section className="zone-editor">
      <h3>Zones</h3>
      <p>Draw rectangular or lasso zones directly on the canvas.</p>
      <label className="field-label" htmlFor="zone-name">
        Zone Name
      </label>
      <input
        id="zone-name"
        className="text-input"
        value={pendingZoneName}
        onChange={(event) => onZoneNameChange(event.target.value)}
        placeholder="Zone name"
      />

      <div className="tool-row">
        <button type="button" className="button-link" onClick={onStartRect} disabled={drawingMode === "RECT"}>
          Draw Rect
        </button>
        <button type="button" className="button-link" onClick={onStartLasso} disabled={drawingMode === "LASSO"}>
          Draw Lasso
        </button>
        <button type="button" className="button-link" onClick={onCancelDrawing} disabled={drawingMode === "NONE"}>
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
        <ul className="zone-list">
          {sceneSpec.zones.map((zone) => (
            <li key={zone.id} className="zone-item">
              <span>
                {zone.name} ({zone.shape.type}) {Math.round(zone.shape.x)},{Math.round(zone.shape.y)} /{" "}
                {Math.round(zone.shape.width)}x{Math.round(zone.shape.height)}
              </span>
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
      )}
    </section>
  );
}
