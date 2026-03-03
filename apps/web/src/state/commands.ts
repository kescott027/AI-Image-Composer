import type { SceneSpec } from "@ai-image-composer/shared";

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
          width: 120,
          height: 84,
          rotation_deg: 0,
        },
      });
      return next;
    },
  };
}
