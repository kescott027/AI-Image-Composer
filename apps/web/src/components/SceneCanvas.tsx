import { useMemo, useRef, useState } from "react";
import type { PointerEventHandler, WheelEventHandler } from "react";

import type { SceneSpec } from "@ai-image-composer/shared";
import { nextScaleFromWheel } from "./canvasMath";

interface SceneCanvasProps {
  sceneSpec: SceneSpec;
  selectedObjectId: string | null;
  wireframeArtifactsByObjectId?: Record<string, string>;
  objectRenderArtifactsByObjectId?: Record<string, string>;
  onSelectObject: (objectId: string | null) => void;
}

const LAYER_COLORS = ["#e65b2d", "#2d7de6", "#2aa06a", "#8a4de0", "#d04e89"];

interface CanvasObject {
  id: string;
  name: string;
  layerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDeg: number;
  zIndex: number;
}

function toCanvasObjects(sceneSpec: SceneSpec): CanvasObject[] {
  return sceneSpec.objects.map((object, index) => {
    const transform = object.transform ?? {
      x: 60 + index * 18,
      y: 60 + index * 18,
      scale_x: 1,
      scale_y: 1,
      width: 110,
      height: 80,
      rotation_deg: 0,
      z_index: index,
      anchor: "top_left",
    };

    return {
      id: object.id,
      name: object.name,
      layerId: object.layer_id,
      x: transform.x,
      y: transform.y,
      width: transform.width * transform.scale_x,
      height: transform.height * transform.scale_y,
      rotationDeg: transform.rotation_deg,
      zIndex: transform.z_index,
    };
  });
}

export function SceneCanvas({
  sceneSpec,
  selectedObjectId,
  wireframeArtifactsByObjectId = {},
  objectRenderArtifactsByObjectId = {},
  onSelectObject,
}: SceneCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 30, y: 30 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);

  const visibleLayers = useMemo(
    () => sceneSpec.layers.filter((layer) => layer.visible).sort((a, b) => a.order - b.order),
    [sceneSpec.layers],
  );
  const canvasObjects = useMemo(
    () =>
      toCanvasObjects(sceneSpec).sort((a, b) => {
        const layerOrderA = visibleLayers.find((layer) => layer.id === a.layerId)?.order ?? 0;
        const layerOrderB = visibleLayers.find((layer) => layer.id === b.layerId)?.order ?? 0;
        if (layerOrderA !== layerOrderB) {
          return layerOrderA - layerOrderB;
        }
        return a.zIndex - b.zIndex;
      }),
    [sceneSpec, visibleLayers],
  );

  const layerById = useMemo(() => {
    const lookup = new Map<string, { name: string; color: string }>();
    visibleLayers.forEach((layer, index) => {
      lookup.set(layer.id, {
        name: layer.name,
        color: LAYER_COLORS[index % LAYER_COLORS.length] ?? "#2d7de6",
      });
    });
    return lookup;
  }, [visibleLayers]);

  const onWheel: WheelEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setScale((current) => nextScaleFromWheel(current, event.deltaY));
  };

  const onPointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    if (event.button !== 0) {
      return;
    }

    if ((event.target as HTMLElement).closest("[data-object-id]")) {
      return;
    }
    onSelectObject(null);

    setIsPanning(true);
    setPanStart({ x: event.clientX - offset.x, y: event.clientY - offset.y });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
    if (!isPanning || !panStart) {
      return;
    }
    setOffset({ x: event.clientX - panStart.x, y: event.clientY - panStart.y });
  };

  const stopPanning = () => {
    setIsPanning(false);
    setPanStart(null);
  };

  return (
    <section className="canvas-panel" aria-label="Canvas panel">
      <div className="canvas-header">
        <h2>Canvas</h2>
        <div className="canvas-controls">
          <button type="button" className="mini-button" onClick={() => setScale(1)}>
            Reset Zoom
          </button>
          <span>{Math.round(scale * 100)}%</span>
        </div>
      </div>

      <div
        ref={canvasRef}
        className={`canvas-surface ${isPanning ? "is-panning" : ""}`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopPanning}
        onPointerCancel={stopPanning}
      >
        <svg className="canvas-svg" viewBox="0 0 900 600" role="img" aria-label="Scene canvas viewport">
          <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
            <rect x={0} y={0} width={820} height={520} rx={12} className="canvas-board" />

            {canvasObjects.map((object) => {
              const layerInfo = layerById.get(object.layerId);
              if (!layerInfo) {
                return null;
              }

              const isSelected = selectedObjectId === object.id;
              const objectRenderArtifactId = objectRenderArtifactsByObjectId[object.id];
              const wireframeArtifactId = wireframeArtifactsByObjectId[object.id];
              const artifactToDisplay = objectRenderArtifactId ?? wireframeArtifactId;

              return (
                <g
                  key={object.id}
                  data-object-id={object.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectObject(object.id);
                  }}
                >
                  <g
                    transform={`translate(${object.x + object.width / 2}, ${object.y + object.height / 2}) rotate(${object.rotationDeg}) translate(${-object.width / 2}, ${-object.height / 2})`}
                  >
                    {artifactToDisplay ? (
                      <image
                        href={`/api/artifacts/${artifactToDisplay}`}
                        x={0}
                        y={0}
                        width={object.width}
                        height={object.height}
                        preserveAspectRatio="none"
                        opacity={objectRenderArtifactId ? 1 : 0.78}
                      />
                    ) : null}
                    <rect
                      x={0}
                      y={0}
                      width={object.width}
                      height={object.height}
                      rx={10}
                      fill={artifactToDisplay ? `${layerInfo.color}10` : `${layerInfo.color}33`}
                      stroke={isSelected ? "#0d1f3a" : layerInfo.color}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                    <text x={10} y={22} className="canvas-object-label">
                      {object.name}
                    </text>
                    <text x={10} y={42} className="canvas-layer-label">
                      {layerInfo.name}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="canvas-footer">
        <span>Visible layers: {visibleLayers.length}</span>
        <span>Objects: {canvasObjects.length}</span>
        <span>Renders: {Object.keys(objectRenderArtifactsByObjectId).length}</span>
        <span>Wireframes: {Object.keys(wireframeArtifactsByObjectId).length}</span>
        <span>Selection: {selectedObjectId ?? "none"}</span>
      </div>
    </section>
  );
}
