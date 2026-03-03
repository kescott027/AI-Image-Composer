import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { createScene, listScenes, type SceneRead } from "../api/scenes";
import { ROUTES } from "../routes";

export function SceneListPage() {
  const navigate = useNavigate();
  const { projectId = "" } = useParams();
  const [scenes, setScenes] = useState<SceneRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState("Loading scenes...");
  const [newSceneTitle, setNewSceneTitle] = useState("Untitled Scene");
  const [newScenePrompt, setNewScenePrompt] = useState("");
  const [newSceneStylePreset, setNewSceneStylePreset] = useState("cinematic");

  const loadScenes = async () => {
    setIsLoading(true);
    try {
      const loaded = await listScenes(projectId);
      setScenes(loaded);
      setFeedback(loaded.length === 0 ? "No scenes yet. Create one below." : "Scenes loaded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load scenes";
      setFeedback(`Scene load failed: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadScenes();
  }, [projectId]);

  const createNewScene = async () => {
    if (!projectId || !newSceneTitle.trim()) {
      return;
    }
    try {
      const created = await createScene({
        project_id: projectId,
        title: newSceneTitle.trim(),
        overarching_prompt: newScenePrompt.trim(),
        style_preset: newSceneStylePreset,
      });
      setScenes((current) => [created, ...current]);
      setFeedback(`Created scene ${created.title}.`);
      navigate(ROUTES.sceneEditor(created.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create scene";
      setFeedback(`Create failed: ${message}`);
    }
  };

  return (
    <main className="page-wrap">
      <header className="page-header">
        <h1>Scenes</h1>
        <p>Project: {projectId || "unknown"}</p>
      </header>

      <div className="toolbar-row">
        <Link to={ROUTES.projects} className="button-link">
          Back to Projects
        </Link>
      </div>

      <section className="project-create">
        <label className="field-label" htmlFor="new-scene-title">
          New Scene Title
        </label>
        <input
          id="new-scene-title"
          className="text-input"
          value={newSceneTitle}
          onChange={(event) => setNewSceneTitle(event.target.value)}
          placeholder="Scene title"
        />
        <label className="field-label" htmlFor="new-scene-prompt">
          Overarching Prompt
        </label>
        <textarea
          id="new-scene-prompt"
          className="prompt-input"
          value={newScenePrompt}
          onChange={(event) => setNewScenePrompt(event.target.value)}
          placeholder="Describe the full scene mood/composition..."
          rows={3}
        />
        <label className="field-label" htmlFor="new-scene-style-preset">
          Style Preset
        </label>
        <select
          id="new-scene-style-preset"
          className="prompt-select"
          value={newSceneStylePreset}
          onChange={(event) => setNewSceneStylePreset(event.target.value)}
        >
          <option value="cinematic">cinematic</option>
          <option value="illustration">illustration</option>
          <option value="photoreal">photoreal</option>
          <option value="minimal">minimal</option>
          <option value="storybook">storybook</option>
          <option value="default">default</option>
        </select>
        <div className="tool-row">
          <button type="button" className="button-link" onClick={() => void createNewScene()}>
            Create Scene + Start Compose
          </button>
          <button
            type="button"
            className="mini-button"
            onClick={() => void loadScenes()}
            disabled={isLoading}
          >
            Refresh
          </button>
        </div>
        <p className="generation-status">{feedback}</p>
      </section>

      <section className="card-grid">
        {scenes.map((scene) => (
          <Link key={scene.id} to={ROUTES.sceneEditor(scene.id)} className="card-link">
            <article className="card">
              <h2>{scene.title}</h2>
              <p>ID: {scene.id}</p>
              <span>
                Updated:{" "}
                {scene.updated_at ? new Date(scene.updated_at).toLocaleDateString() : "n/a"}
              </span>
            </article>
          </Link>
        ))}
        {!isLoading && scenes.length === 0 ? (
          <article className="card card-empty">
            <h2>No scenes yet</h2>
            <p>Create a scene and continue to the editor.</p>
          </article>
        ) : null}
      </section>
    </main>
  );
}
