import type { RelationPredicate, SceneSpec } from "@ai-image-composer/shared";

export interface SceneCommand {
  name: string;
  apply: (sceneSpec: SceneSpec) => SceneSpec;
}

function cloneSceneSpec(sceneSpec: SceneSpec): SceneSpec {
  return JSON.parse(JSON.stringify(sceneSpec)) as SceneSpec;
}

function createId(prefix: string): string {
  const token = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${token}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeLayerZIndex(sceneSpec: SceneSpec, layerId: string) {
  const objects = sceneSpec.objects
    .filter((object) => object.layer_id === layerId)
    .sort((a, b) => (a.transform?.z_index ?? 0) - (b.transform?.z_index ?? 0));
  objects.forEach((object, index) => {
    if (!object.transform) {
      return;
    }
    object.transform.z_index = index;
  });
}

interface ZoneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function objectBounds(sceneSpec: SceneSpec): Array<{ id: string } & ZoneBounds> {
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
      x: transform.x,
      y: transform.y,
      width: Math.max(1, transform.width * transform.scale_x),
      height: Math.max(1, transform.height * transform.scale_y),
    };
  });
}

function intersects(a: ZoneBounds, b: ZoneBounds): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function inferZoneObjectIds(sceneSpec: SceneSpec, bounds: ZoneBounds): string[] {
  return objectBounds(sceneSpec)
    .filter((entry) => intersects(bounds, entry))
    .map((entry) => entry.id);
}

export function setOverarchingPromptCommand(prompt: string): SceneCommand {
  return {
    name: "SET_OVERARCHING_PROMPT",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      next.scene.overarching_prompt = prompt;
      return next;
    },
  };
}

export function setNegativePromptCommand(negativePrompt: string): SceneCommand {
  return {
    name: "SET_NEGATIVE_PROMPT",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      next.scene.negative_prompt = negativePrompt;
      return next;
    },
  };
}

export function setStylePresetCommand(stylePreset: string): SceneCommand {
  return {
    name: "SET_STYLE_PRESET",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      next.scene.style_preset = stylePreset;
      return next;
    },
  };
}

export function setRefineStrengthCommand(refineStrength: number): SceneCommand {
  return {
    name: "SET_REFINE_STRENGTH",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      next.settings.defaults.refine_strength = Number(clamp(refineStrength, 0, 1).toFixed(2));
      return next;
    },
  };
}

export function addLayerCommand(
  name: string,
  type: "BACKGROUND" | "OBJECT" | "MASK" | "COMPOSITE" | "ZONE" = "OBJECT",
): SceneCommand {
  return {
    name: "ADD_LAYER",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      const maxOrder = next.layers.reduce((highest, layer) => Math.max(highest, layer.order), 0);
      next.layers.push({
        id: createId("layer"),
        type,
        name,
        order: maxOrder + 1,
        visible: true,
        locked: false,
        metadata: {},
      });
      return next;
    },
  };
}

export function toggleLayerVisibilityCommand(layerId: string): SceneCommand {
  return {
    name: "TOGGLE_LAYER_VISIBILITY",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      next.layers = next.layers.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
      );
      return next;
    },
  };
}

export function toggleLayerLockCommand(layerId: string): SceneCommand {
  return {
    name: "TOGGLE_LAYER_LOCK",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      next.layers = next.layers.map((layer) =>
        layer.id === layerId ? { ...layer, locked: !layer.locked } : layer,
      );
      return next;
    },
  };
}

export function moveLayerCommand(layerId: string, direction: "UP" | "DOWN"): SceneCommand {
  return {
    name: direction === "UP" ? "MOVE_LAYER_UP" : "MOVE_LAYER_DOWN",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      const ordered = [...next.layers].sort((a, b) => a.order - b.order);
      const currentIndex = ordered.findIndex((layer) => layer.id === layerId);
      if (currentIndex === -1) {
        return next;
      }

      const neighborIndex = direction === "UP" ? currentIndex - 1 : currentIndex + 1;
      if (neighborIndex < 0 || neighborIndex >= ordered.length) {
        return next;
      }

      [ordered[currentIndex], ordered[neighborIndex]] = [ordered[neighborIndex], ordered[currentIndex]];
      const orderById = new Map(ordered.map((layer, index) => [layer.id, index]));

      next.layers = next.layers.map((layer) => ({
        ...layer,
        order: orderById.get(layer.id) ?? layer.order,
      }));
      return next;
    },
  };
}

export function addObjectCommand(layerId: string, name: string): SceneCommand {
  return {
    name: "ADD_OBJECT",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      const targetLayer = next.layers.find((layer) => layer.id === layerId);
      if (!targetLayer) {
        return next;
      }

      const objectIndex = next.objects.length;
      const maxZ = next.objects
        .filter((object) => object.layer_id === layerId)
        .reduce((highest, object) => Math.max(highest, object.transform?.z_index ?? -1), -1);
      next.objects.push({
        id: createId("obj"),
        layer_id: layerId,
        name,
        kind: "prop",
        prompt: "",
        negative_prompt: "",
        transform: {
          x: 80 + objectIndex * 24,
          y: 90 + objectIndex * 20,
          scale_x: 1,
          scale_y: 1,
          rotation_deg: 0,
          z_index: maxZ + 1,
          anchor: "top_left",
          width: 120,
          height: 84,
        },
      });
      return next;
    },
  };
}

export function setObjectPromptCommand(objectId: string, prompt: string): SceneCommand {
  return {
    name: "SET_OBJECT_PROMPT",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      next.objects = next.objects.map((object) =>
        object.id === objectId ? { ...object, prompt } : object,
      );
      return next;
    },
  };
}

export function setObjectNegativePromptCommand(
  objectId: string,
  negativePrompt: string,
): SceneCommand {
  return {
    name: "SET_OBJECT_NEGATIVE_PROMPT",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      next.objects = next.objects.map((object) =>
        object.id === objectId ? { ...object, negative_prompt: negativePrompt } : object,
      );
      return next;
    },
  };
}

export function addRelationCommand(
  subjectObjectId: string,
  predicate: RelationPredicate,
  objectObjectId: string,
  strength = 1,
): SceneCommand {
  return {
    name: "ADD_RELATION",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      if (subjectObjectId === objectObjectId) {
        return next;
      }
      const subjectExists = next.objects.some((object) => object.id === subjectObjectId);
      const objectExists = next.objects.some((object) => object.id === objectObjectId);
      if (!subjectExists || !objectExists) {
        return next;
      }

      const alreadyExists = next.relations.some(
        (relation) =>
          relation.subject_object_id === subjectObjectId &&
          relation.predicate === predicate &&
          relation.object_object_id === objectObjectId,
      );
      if (alreadyExists) {
        return next;
      }

      next.relations.push({
        id: createId("rel"),
        subject_object_id: subjectObjectId,
        predicate,
        object_object_id: objectObjectId,
        strength: Math.min(1, Math.max(0, Number(strength.toFixed(2)))),
        notes: "",
      });
      return next;
    },
  };
}

export function removeRelationCommand(relationId: string): SceneCommand {
  return {
    name: "REMOVE_RELATION",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      next.relations = next.relations.filter((relation) => relation.id !== relationId);
      return next;
    },
  };
}

export function addZoneRectCommand(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options?: {
    includedObjectIds?: string[];
    guidancePrompt?: string;
    negativePrompt?: string;
  },
): SceneCommand {
  return {
    name: "ADD_ZONE_RECT",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      const normalizedBounds = {
        x,
        y,
        width: Math.max(1, width),
        height: Math.max(1, height),
      };
      next.zones.push({
        id: createId("zone"),
        name,
        shape: {
          type: "rect",
          ...normalizedBounds,
        },
        included_object_ids: options?.includedObjectIds ?? inferZoneObjectIds(next, normalizedBounds),
        guidance_prompt: options?.guidancePrompt ?? "",
        negative_prompt: options?.negativePrompt ?? "",
      });
      return next;
    },
  };
}

export function addZoneLassoCommand(
  name: string,
  points: Array<{ x: number; y: number }>,
  options?: {
    includedObjectIds?: string[];
    guidancePrompt?: string;
    negativePrompt?: string;
  },
): SceneCommand {
  return {
    name: "ADD_ZONE_LASSO",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      if (points.length < 3) {
        return next;
      }

      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      next.zones.push({
        id: createId("zone"),
        name,
        shape: {
          type: "lasso",
          x: minX,
          y: minY,
          width: Math.max(1, maxX - minX),
          height: Math.max(1, maxY - minY),
          points,
        },
        included_object_ids:
          options?.includedObjectIds ??
          inferZoneObjectIds(next, {
            x: minX,
            y: minY,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY),
          }),
        guidance_prompt: options?.guidancePrompt ?? "",
        negative_prompt: options?.negativePrompt ?? "",
      });
      return next;
    },
  };
}

export function removeZoneCommand(zoneId: string): SceneCommand {
  return {
    name: "REMOVE_ZONE",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      next.zones = next.zones.filter((zone) => zone.id !== zoneId);
      return next;
    },
  };
}

export function moveObjectCommand(objectId: string, deltaX: number, deltaY: number): SceneCommand {
  return {
    name: "MOVE_OBJECT",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      next.objects = next.objects.map((object) => {
        if (object.id !== objectId || !object.transform) {
          return object;
        }
        return {
          ...object,
          transform: {
            ...object.transform,
            x: object.transform.x + deltaX,
            y: object.transform.y + deltaY,
          },
        };
      });
      return next;
    },
  };
}

export function rotateObjectCommand(objectId: string, deltaDeg: number): SceneCommand {
  return {
    name: "ROTATE_OBJECT",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      next.objects = next.objects.map((object) => {
        if (object.id !== objectId || !object.transform) {
          return object;
        }
        return {
          ...object,
          transform: {
            ...object.transform,
            rotation_deg: object.transform.rotation_deg + deltaDeg,
          },
        };
      });
      return next;
    },
  };
}

export function scaleObjectCommand(objectId: string, multiplier: number): SceneCommand {
  return {
    name: "SCALE_OBJECT",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      next.objects = next.objects.map((object) => {
        if (object.id !== objectId || !object.transform) {
          return object;
        }
        const nextScaleX = Math.min(3, Math.max(0.2, Number((object.transform.scale_x * multiplier).toFixed(2))));
        const nextScaleY = Math.min(3, Math.max(0.2, Number((object.transform.scale_y * multiplier).toFixed(2))));
        return {
          ...object,
          transform: {
            ...object.transform,
            scale_x: nextScaleX,
            scale_y: nextScaleY,
          },
        };
      });
      return next;
    },
  };
}

export function moveObjectZOrderCommand(objectId: string, direction: "UP" | "DOWN"): SceneCommand {
  return {
    name: direction === "UP" ? "MOVE_OBJECT_Z_UP" : "MOVE_OBJECT_Z_DOWN",
    apply(sceneSpec) {
      const next = cloneSceneSpec(sceneSpec);
      const object = next.objects.find((item) => item.id === objectId);
      if (!object || !object.transform) {
        return next;
      }

      normalizeLayerZIndex(next, object.layer_id);
      const layerObjects = next.objects
        .filter((item) => item.layer_id === object.layer_id && item.transform)
        .sort((a, b) => (a.transform?.z_index ?? 0) - (b.transform?.z_index ?? 0));
      const currentIndex = layerObjects.findIndex((item) => item.id === objectId);
      if (currentIndex === -1) {
        return next;
      }

      const swapIndex = direction === "UP" ? currentIndex + 1 : currentIndex - 1;
      if (swapIndex < 0 || swapIndex >= layerObjects.length) {
        return next;
      }

      const current = layerObjects[currentIndex];
      const neighbor = layerObjects[swapIndex];
      if (!current?.transform || !neighbor?.transform) {
        return next;
      }

      const currentZ = current.transform.z_index;
      current.transform.z_index = neighbor.transform.z_index;
      neighbor.transform.z_index = currentZ;

      return next;
    },
  };
}
