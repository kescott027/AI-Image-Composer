import { useEffect, useState } from "react";

import type { SceneSpec } from "@ai-image-composer/shared";

export interface ObjectPromptEditorValues {
  prompt: string;
  negativePrompt: string;
}

interface ObjectPromptEditorProps {
  selectedObject: SceneSpec["objects"][number] | null;
  onApply: (values: ObjectPromptEditorValues) => void;
}

export function ObjectPromptEditor({ selectedObject, onApply }: ObjectPromptEditorProps) {
  const [prompt, setPrompt] = useState(selectedObject?.prompt ?? "");
  const [negativePrompt, setNegativePrompt] = useState(selectedObject?.negative_prompt ?? "");

  useEffect(() => {
    setPrompt(selectedObject?.prompt ?? "");
    setNegativePrompt(selectedObject?.negative_prompt ?? "");
  }, [selectedObject?.id, selectedObject?.prompt, selectedObject?.negative_prompt]);

  if (!selectedObject) {
    return (
      <section className="object-prompt-editor">
        <h3>Object Prompt</h3>
        <p>Select an object in the canvas to edit its prompt fields.</p>
      </section>
    );
  }

  return (
    <section className="object-prompt-editor">
      <h3>Object Prompt</h3>
      <p>Selected: {selectedObject.name}</p>
      <label className="field-label" htmlFor="object-prompt">
        Prompt
      </label>
      <textarea
        id="object-prompt"
        className="prompt-input"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Describe this object..."
      />

      <label className="field-label" htmlFor="object-negative-prompt">
        Negative Prompt
      </label>
      <textarea
        id="object-negative-prompt"
        className="prompt-input"
        value={negativePrompt}
        onChange={(event) => setNegativePrompt(event.target.value)}
        placeholder="What should be avoided for this object?"
      />

      <button
        type="button"
        className="button-link"
        onClick={() => onApply({ prompt, negativePrompt })}
      >
        Apply Object Prompt
      </button>
    </section>
  );
}
