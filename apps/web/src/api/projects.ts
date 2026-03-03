import { parseErrorMessage } from "./http";

export interface ProjectRead {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string | null;
}

export interface ProjectCreate {
  name: string;
  description?: string;
}

export async function listProjects(): Promise<ProjectRead[]> {
  const response = await fetch("/api/projects");
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Failed to load projects"));
  }
  return (await response.json()) as ProjectRead[];
}

export async function createProject(payload: ProjectCreate): Promise<ProjectRead> {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Failed to create project"));
  }
  return (await response.json()) as ProjectRead;
}
