import { Link } from "react-router-dom";

import { ROUTES } from "../routes";

const PROJECTS = [
  { id: "proj_demo", name: "Demo Project", updatedAt: "2026-03-03" },
  { id: "proj_cabin", name: "Cabin Interior", updatedAt: "2026-03-02" },
  { id: "proj_city", name: "City Rooftop", updatedAt: "2026-03-01" },
];

export function ProjectListPage() {
  return (
    <main className="page-wrap">
      <header className="page-header">
        <h1>Projects</h1>
        <p>Select a project to open its scenes.</p>
      </header>

      <section className="card-grid">
        {PROJECTS.map((project) => (
          <Link key={project.id} to={ROUTES.projectScenes(project.id)} className="card-link">
            <article className="card">
              <h2>{project.name}</h2>
              <p>ID: {project.id}</p>
              <span>Updated: {project.updatedAt}</span>
            </article>
          </Link>
        ))}
      </section>
    </main>
  );
}
