import { useMemo, useRef, useState } from "react";
import type { PointerEventHandler, WheelEventHandler } from "react";

import type { SceneSpec } from "@ai-image-composer/shared";
import { nextScaleFromWheel } from "./canvasMath";
import type { ZoneDrawingMode } from "./ZoneEditor";

interface SceneCanvasProps {
  sceneSpec: SceneSpec;
  selectedObjectId: string | null;
  blockingArtifactId?: string | null;
  wireframeArtifactsByObjectId?: Record<string, string>;
  objectRenderArtifactsByObjectId?: Record<string, string>;
  finalCompositeArtifactId?: string | null;
  zoneDrawingMode?: ZoneDrawingMode;
  pendingLassoPoints?: Array<{ x: number; y: number }>;
  onCreateRectZone?: (zone: { x: number; y: number; width: number; height: number }) => void;
  onAddLassoPoint?: (point: { x: number; y: number }) => void;
  onMoveObject?: (objectId: string, deltaX: number, deltaY: number) => void;
  onSelectObject: (objectId: string | null) => void;
}

const LAYER_COLORS = ["#e65b2d", "#2d7de6", "#2aa06a", "#8a4de0", "#d04e89"];
const VIEWBOX_WIDTH = 900;
const VIEWBOX_HEIGHT = 600;
const CANVAS_WIDTH = 820;
const CANVAS_HEIGHT = 520;

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
  anchored: boolean;
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
      anchored: object.metadata?.anchored === true,
    };
  });
}

export function SceneCanvas({
  sceneSpec,
  selectedObjectId,
  blockingArtifactId = null,
  wireframeArtifactsByObjectId = {},
  objectRenderArtifactsByObjectId = {},
  finalCompositeArtifactId = null,
  zoneDrawingMode = "NONE",
  pendingLassoPoints = [],
  onCreateRectZone,
  onAddLassoPoint,
  onMoveObject,
  onSelectObject,
}: SceneCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 30, y: 30 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [dragState, setDragState] = useState<{
    objectId: string;
    point: { x: number; y: number };
  } | null>(null);
  const [rectDraft, setRectDraft] = useState<{
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);

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

  const pointerToScene = (event: { clientX: number; clientY: number }) => {
    const target = canvasRef.current?.querySelector(".canvas-svg");
    if (!target) {
      return null;
    }
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    const svgX = ((event.clientX - rect.left) / rect.width) * VIEWBOX_WIDTH;
    const svgY = ((event.clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT;
    const x = Math.min(CANVAS_WIDTH, Math.max(0, (svgX - offset.x) / scale));
    const y = Math.min(CANVAS_HEIGHT, Math.max(0, (svgY - offset.y) / scale));
    return { x, y };
  };

  const onPointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    if (event.button !== 0) {
      return;
    }

    if (zoneDrawingMode === "RECT") {
      const point = pointerToScene(event);
      if (!point) {
        return;
      }
      setRectDraft({ start: point, current: point });
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      return;
    }

    if (zoneDrawingMode === "LASSO") {
      const point = pointerToScene(event);
      if (point && onAddLassoPoint) {
        onAddLassoPoint(point);
      }
      onSelectObject(null);
      return;
    }

    const objectNode = (event.target as HTMLElement).closest("[data-object-id]");
    if (objectNode) {
      const objectId = objectNode.getAttribute("data-object-id");
      if (!objectId) {
        return;
      }
      const selectedObject = canvasObjects.find((object) => object.id === objectId);
      if (!selectedObject) {
        return;
      }
      onSelectObject(objectId);
      const isAnchored = selectedObject.anchored;
      if (!isAnchored && zoneDrawingMode === "NONE" && onMoveObject) {
        const point = pointerToScene(event);
        if (point) {
          setDragState({ objectId, point });
          (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        }
      }
      return;
    }
    onSelectObject(null);

    setIsPanning(true);
    setPanStart({ x: event.clientX - offset.x, y: event.clientY - offset.y });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
    if (zoneDrawingMode === "RECT" && rectDraft) {
      const point = pointerToScene(event);
      if (!point) {
        return;
      }
      setRectDraft((current) =>
        current
          ? {
              start: current.start,
              current: point,
            }
          : null,
      );
      return;
    }

    if (dragState && zoneDrawingMode === "NONE") {
      const point = pointerToScene(event);
      if (!point || !onMoveObject) {
        return;
      }
      const deltaX = point.x - dragState.point.x;
      const deltaY = point.y - dragState.point.y;
      if (Math.abs(deltaX) >= 0.5 || Math.abs(deltaY) >= 0.5) {
        onMoveObject(dragState.objectId, Number(deltaX.toFixed(2)), Number(deltaY.toFixed(2)));
        setDragState({ objectId: dragState.objectId, point });
      }
      return;
    }

    if (!isPanning || !panStart) {
      return;
    }
    setOffset({ x: event.clientX - panStart.x, y: event.clientY - panStart.y });
  };

  const stopPanning: PointerEventHandler<HTMLDivElement> = () => {
    if (dragState) {
      setDragState(null);
      return;
    }

    if (zoneDrawingMode === "RECT" && rectDraft) {
      const x = Math.min(rectDraft.start.x, rectDraft.current.x);
      const y = Math.min(rectDraft.start.y, rectDraft.current.y);
      const width = Math.abs(rectDraft.current.x - rectDraft.start.x);
      const height = Math.abs(rectDraft.current.y - rectDraft.start.y);

      if (width >= 4 && height >= 4 && onCreateRectZone) {
        onCreateRectZone({ x, y, width, height });
      }
      setRectDraft(null);
      return;
    }

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
        <svg
          className="canvas-svg"
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          role="img"
          aria-label="Scene canvas viewport"
        >
          <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
            <rect
              x={0}
              y={0}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              rx={12}
              className="canvas-board"
            />
            {blockingArtifactId ? (
              <image
                href={`/api/artifacts/${blockingArtifactId}`}
                x={0}
                y={0}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                preserveAspectRatio="none"
                opacity={0.6}
                pointerEvents="none"
              />
            ) : null}

            {sceneSpec.zones.map((zone) => (
              <g key={zone.id}>
                {zone.shape.type === "lasso" &&
                zone.shape.points &&
                zone.shape.points.length >= 3 ? (
                  <polygon
                    points={zone.shape.points.map((point) => `${point.x},${point.y}`).join(" ")}
                    className="canvas-zone"
                  />
                ) : (
                  <rect
                    x={zone.shape.x}
                    y={zone.shape.y}
                    width={zone.shape.width}
                    height={zone.shape.height}
                    rx={8}
                    className="canvas-zone"
                  />
                )}
                <text x={zone.shape.x + 8} y={zone.shape.y + 16} className="canvas-zone-label">
                  {zone.name}
                </text>
              </g>
            ))}

            {zoneDrawingMode === "LASSO" && pendingLassoPoints.length > 0 ? (
              <g>
                <polyline
                  points={pendingLassoPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                  className="canvas-zone-draft"
                />
                {pendingLassoPoints.map((point, index) => (
                  <circle
                    key={`lasso-point-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={3}
                    className="canvas-zone-point"
                  />
                ))}
              </g>
            ) : null}

            {zoneDrawingMode === "RECT" && rectDraft ? (
              <rect
                x={Math.min(rectDraft.start.x, rectDraft.current.x)}
                y={Math.min(rectDraft.start.y, rectDraft.current.y)}
                width={Math.abs(rectDraft.current.x - rectDraft.start.x)}
                height={Math.abs(rectDraft.current.y - rectDraft.start.y)}
                rx={6}
                className="canvas-zone-draft"
              />
            ) : null}

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
                    if (zoneDrawingMode !== "NONE") {
                      return;
                    }
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
                    {object.anchored ? (
                      <text x={10} y={60} className="canvas-layer-label">
                        anchored
                      </text>
                    ) : null}
                  </g>
                </g>
              );
            })}
            {finalCompositeArtifactId ? (
              <image
                href={`/api/artifacts/${finalCompositeArtifactId}`}
                x={0}
                y={0}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                preserveAspectRatio="none"
                pointerEvents="none"
              />
            ) : null}
          </g>
        </svg>
      </div>

      <div className="canvas-footer">
        <span>Visible layers: {visibleLayers.length}</span>
        <span>Objects: {canvasObjects.length}</span>
        <span>Renders: {Object.keys(objectRenderArtifactsByObjectId).length}</span>
        <span>Wireframes: {Object.keys(wireframeArtifactsByObjectId).length}</span>
        <span>Blocking: {blockingArtifactId ? "on" : "off"}</span>
        <span>Composite: {finalCompositeArtifactId ? "on" : "off"}</span>
        <span>Selection: {selectedObjectId ?? "none"}</span>
      </div>
    </section>
  );
}
