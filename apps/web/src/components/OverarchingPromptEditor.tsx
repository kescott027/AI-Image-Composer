import { useEffect, useState } from "react";

import type { SceneSpec } from "@ai-image-composer/shared";

export interface OverarchingPromptEditorValues {
  overarchingPrompt: string;
  negativePrompt: string;
  stylePreset: string;
}

interface OverarchingPromptEditorProps {
  scene: SceneSpec["scene"];
  onApply: (values: OverarchingPromptEditorValues) => void;
}

const STYLE_PRESETS = [
  "default",
  "cinematic",
  "photoreal",
  "illustration",
  "comic",
  "watercolor",
  "pixel_art",
] as const;

export function OverarchingPromptEditor({ scene, onApply }: OverarchingPromptEditorProps) {
  const [overarchingPrompt, setOverarchingPrompt] = useState(scene.overarching_prompt);
  const [negativePrompt, setNegativePrompt] = useState(scene.negative_prompt ?? "");
  const [stylePreset, setStylePreset] = useState(scene.style_preset ?? "default");

  useEffect(() => {
    setOverarchingPrompt(scene.overarching_prompt);
    setNegativePrompt(scene.negative_prompt ?? "");
    setStylePreset(scene.style_preset ?? "default");
  }, [scene.overarching_prompt, scene.negative_prompt, scene.style_preset]);

  return (
    <section className="prompt-editor">
      <h3>Scene Prompt</h3>
      <p>Apply updates as command entries so they remain undoable and versioned.</p>
      <label className="field-label" htmlFor="scene-overarching-prompt">
        Overarching Prompt
      </label>
      <textarea
        id="scene-overarching-prompt"
        className="prompt-input"
        value={overarchingPrompt}
        onChange={(event) => setOverarchingPrompt(event.target.value)}
        placeholder="Describe the scene..."
      />

      <label className="field-label" htmlFor="scene-negative-prompt">
        Negative Prompt
      </label>
      <textarea
        id="scene-negative-prompt"
        className="prompt-input"
        value={negativePrompt}
        onChange={(event) => setNegativePrompt(event.target.value)}
        placeholder="What should be avoided in the generation?"
      />

      <label className="field-label" htmlFor="scene-style-preset">
        Style Preset
      </label>
      <select
        id="scene-style-preset"
        className="prompt-select"
        value={stylePreset}
        onChange={(event) => setStylePreset(event.target.value)}
      >
        {STYLE_PRESETS.map((preset) => (
          <option key={preset} value={preset}>
            {preset}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="button-link"
        onClick={() => onApply({ overarchingPrompt, negativePrompt, stylePreset })}
      >
        Apply Scene Prompt
      </button>
    </section>
  );
}
