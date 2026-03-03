export const ROUTES = {
  projects: "/projects",
  projectScenes: (projectId: string) => `/projects/${projectId}/scenes`,
  sceneEditor: (sceneId: string) => `/scenes/${sceneId}/editor`,
} as const;
