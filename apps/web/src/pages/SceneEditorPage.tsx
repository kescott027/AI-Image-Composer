import { Link, useParams } from "react-router-dom";

import { ROUTES } from "../routes";

const LAYERS = ["Background", "Objects", "Composite"];
const JOBS = ["SKETCH: queued", "OBJECT_RENDER: idle", "FINAL_COMPOSITE: idle"];

export function SceneEditorPage() {
  const { sceneId = "" } = useParams();

  return (
    <main className="editor-wrap">
      <header className="editor-header">
        <div>
          <h1>Scene Editor</h1>
          <p>Scene: {sceneId || "unknown"}</p>
        </div>
        <Link to={ROUTES.projects} className="button-link">
          Projects
        </Link>
      </header>

      <section className="editor-grid">
        <aside className="panel panel-left">
          <h2>Left Panel</h2>
          <p>Layers and object controls</p>
          <ul>
            {LAYERS.map((layer) => (
              <li key={layer}>{layer}</li>
            ))}
          </ul>
        </aside>

        <section className="canvas-panel" aria-label="Canvas panel">
          <h2>Canvas</h2>
          <div className="canvas-placeholder">Scene canvas viewport</div>
        </section>

        <aside className="panel panel-right">
          <h2>Right Panel</h2>
          <p>Prompt and job controls</p>
          <ul>
            {JOBS.map((job) => (
              <li key={job}>{job}</li>
            ))}
          </ul>
        </aside>
      </section>
    </main>
  );
}
