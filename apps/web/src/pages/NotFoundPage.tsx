import { Link } from "react-router-dom";

import { ROUTES } from "../routes";

export function NotFoundPage() {
  return (
    <main className="page-wrap">
      <header className="page-header">
        <h1>Route Not Found</h1>
        <p>This route has not been mapped yet.</p>
      </header>
      <Link className="button-link" to={ROUTES.projects}>
        Go to Projects
      </Link>
    </main>
  );
}
