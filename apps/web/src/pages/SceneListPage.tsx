import { Link, useParams } from "react-router-dom";

import { ROUTES } from "../routes";

const SCENES_BY_PROJECT: Record<string, Array<{ id: string; title: string; objects: number }>> = {
  proj_demo: [
    { id: "scene_intro", title: "Intro Scene", objects: 3 },
    { id: "scene_action", title: "Action Scene", objects: 5 },
  ],
  proj_cabin: [
    { id: "scene_sunrise", title: "Warm Sunrise", objects: 4 },
    { id: "scene_evening", title: "Evening Mood", objects: 6 },
  ],
  proj_city: [{ id: "scene_rooftop", title: "Rooftop Focus", objects: 5 }],
};

export function SceneListPage() {
  const { projectId = "" } = useParams();
  const scenes = SCENES_BY_PROJECT[projectId] ?? [];

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

      <section className="card-grid">
        {scenes.map((scene) => (
          <Link key={scene.id} to={ROUTES.sceneEditor(scene.id)} className="card-link">
            <article className="card">
              <h2>{scene.title}</h2>
              <p>ID: {scene.id}</p>
              <span>Objects: {scene.objects}</span>
            </article>
          </Link>
        ))}
        {scenes.length === 0 ? (
          <article className="card card-empty">
            <h2>No scenes yet</h2>
            <p>Create a scene from the API workflow and return here.</p>
          </article>
        ) : null}
      </section>
    </main>
  );
}
