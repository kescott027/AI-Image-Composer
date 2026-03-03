import { Navigate, Route, Routes } from "react-router-dom";

import { ROUTES } from "./routes";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProjectListPage } from "./pages/ProjectListPage";
import { SceneEditorPage } from "./pages/SceneEditorPage";
import { SceneListPage } from "./pages/SceneListPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={ROUTES.projects} replace />} />
      <Route path={ROUTES.projects} element={<ProjectListPage />} />
      <Route path="/projects/:projectId/scenes" element={<SceneListPage />} />
      <Route path="/scenes/:sceneId/editor" element={<SceneEditorPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
