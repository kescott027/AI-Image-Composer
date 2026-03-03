import type { SceneSpec } from "@ai-image-composer/shared";

import {
  addLayerCommand,
  moveLayerCommand,
  toggleLayerLockCommand,
  toggleLayerVisibilityCommand,
} from "../state/commands";
import type { SceneCommand } from "../state/commands";

interface LayersPanelProps {
  sceneSpec: SceneSpec;
  executeCommand: (command: SceneCommand) => void;
}

export function LayersPanel({ sceneSpec, executeCommand }: LayersPanelProps) {
  const orderedLayers = [...sceneSpec.layers].sort((a, b) => a.order - b.order);

  return (
    <aside className="panel panel-left">
      <h2>Layers Panel</h2>
      <p>Create, toggle, lock, and reorder layers.</p>

      <div className="panel-actions">
        <button
          type="button"
          className="button-link"
          onClick={() => executeCommand(addLayerCommand(`Layer ${sceneSpec.layers.length + 1}`))}
        >
          Add Layer
        </button>
      </div>

      <ul className="layer-list">
        {orderedLayers.map((layer, index) => {
          const isFirst = index === 0;
          const isLast = index === orderedLayers.length - 1;
          return (
            <li key={layer.id} className="layer-item">
              <div className="layer-main">
                <strong>{layer.name}</strong>
                <span>{layer.type}</span>
              </div>

              <div className="layer-actions">
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => executeCommand(toggleLayerVisibilityCommand(layer.id))}
                >
                  {layer.visible ? "Hide" : "Show"}
                </button>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => executeCommand(toggleLayerLockCommand(layer.id))}
                >
                  {layer.locked ? "Unlock" : "Lock"}
                </button>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => executeCommand(moveLayerCommand(layer.id, "UP"))}
                  disabled={isFirst}
                >
                  Up
                </button>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => executeCommand(moveLayerCommand(layer.id, "DOWN"))}
                  disabled={isLast}
                >
                  Down
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
