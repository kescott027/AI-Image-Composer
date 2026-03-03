import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { createProject, listProjects, type ProjectRead } from "../api/projects";
import { createScene } from "../api/scenes";
import { ROUTES } from "../routes";

export function ProjectListPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState("Loading projects...");
  const [newProjectName, setNewProjectName] = useState("");
  const [quickSceneTitle, setQuickSceneTitle] = useState("Scene 1");
  const [quickScenePrompt, setQuickScenePrompt] = useState("");
  const [quickSceneStyle, setQuickSceneStyle] = useState("cinematic");

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const loaded = await listProjects();
      setProjects(loaded);
      setFeedback(loaded.length === 0 ? "No projects yet. Create one below." : "Projects loaded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load projects";
      setFeedback(`Project load failed: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  const createNewProject = async () => {
    if (!newProjectName.trim()) {
      return;
    }
    try {
      const created = await createProject({ name: newProjectName.trim() });
      setProjects((current) => [created, ...current]);
      setNewProjectName("");
      setFeedback(`Created project ${created.name}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create project";
      setFeedback(`Create failed: ${message}`);
    }
  };

  const quickStartProject = async () => {
    if (!newProjectName.trim()) {
      setFeedback("Project name is required for quick start.");
      return;
    }

    try {
      const createdProject = await createProject({ name: newProjectName.trim() });
      setProjects((current) => [createdProject, ...current]);

      const createdScene = await createScene({
        project_id: createdProject.id,
        title: quickSceneTitle.trim() || "Scene 1",
        overarching_prompt: quickScenePrompt.trim(),
        style_preset: quickSceneStyle,
      });
      setFeedback(`Quick start ready: ${createdProject.name} / ${createdScene.title}.`);
      setNewProjectName("");
      navigate(ROUTES.sceneEditor(createdScene.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to quick start project";
      setFeedback(`Quick start failed: ${message}`);
    }
  };

  return (
    <main className="page-wrap">
      <header className="page-header">
        <h1>Projects</h1>
        <p>Select a project to open its scenes.</p>
      </header>

      <section className="project-create">
        <label className="field-label" htmlFor="new-project-name">
          New Project Name
        </label>
        <input
          id="new-project-name"
          className="text-input"
          value={newProjectName}
          onChange={(event) => setNewProjectName(event.target.value)}
          placeholder="Project name"
        />
        <label className="field-label" htmlFor="quick-scene-title">
          First Scene Title
        </label>
        <input
          id="quick-scene-title"
          className="text-input"
          value={quickSceneTitle}
          onChange={(event) => setQuickSceneTitle(event.target.value)}
          placeholder="Scene title"
        />
        <label className="field-label" htmlFor="quick-scene-prompt">
          First Scene Overarching Prompt
        </label>
        <textarea
          id="quick-scene-prompt"
          className="prompt-input"
          value={quickScenePrompt}
          onChange={(event) => setQuickScenePrompt(event.target.value)}
          placeholder="Describe the full image direction..."
          rows={3}
        />
        <label className="field-label" htmlFor="quick-scene-style">
          First Scene Style Preset
        </label>
        <select
          id="quick-scene-style"
          className="prompt-select"
          value={quickSceneStyle}
          onChange={(event) => setQuickSceneStyle(event.target.value)}
        >
          <option value="cinematic">cinematic</option>
          <option value="illustration">illustration</option>
          <option value="photoreal">photoreal</option>
          <option value="minimal">minimal</option>
          <option value="storybook">storybook</option>
          <option value="default">default</option>
        </select>
        <div className="tool-row">
          <button type="button" className="button-link" onClick={() => void createNewProject()}>
            Create Project
          </button>
          <button type="button" className="button-link" onClick={() => void quickStartProject()}>
            Quick Start Composer
          </button>
          <button
            type="button"
            className="mini-button"
            onClick={() => void loadProjects()}
            disabled={isLoading}
          >
            Refresh
          </button>
        </div>
        <p className="generation-status">{feedback}</p>
      </section>

      <section className="card-grid">
        {projects.map((project) => (
          <Link key={project.id} to={ROUTES.projectScenes(project.id)} className="card-link">
            <article className="card">
              <h2>{project.name}</h2>
              <p>ID: {project.id}</p>
              <span>
                Created:{" "}
                {project.created_at ? new Date(project.created_at).toLocaleDateString() : "n/a"}
              </span>
            </article>
          </Link>
        ))}
        {!isLoading && projects.length === 0 ? (
          <article className="card card-empty">
            <h2>No projects yet</h2>
            <p>Create your first project to begin composing scenes.</p>
          </article>
        ) : null}
      </section>
    </main>
  );
}
