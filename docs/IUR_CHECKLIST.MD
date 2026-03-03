# Initial Usable Release (IUR) Checklist

This checklist maps directly to Story 24 and validates that the MVP user flow works end-to-end.

## Required Workflow

1. Create a project.
2. Create a scene.
3. Open scene editor and set scene-level prompt.
4. Add 2-5 objects.
5. Generate wireframes for objects.
6. Position/transform objects in canvas.
7. Render object artifacts.
8. Generate final composite artifact.
9. Reload scene and verify prompts, objects, relations, zones, jobs, and artifacts are still available.

## Automated Smoke Validation

Run:

```bash
make iur-smoke
```

The script executes API-only smoke validation for project/scene creation, SceneSpec persistence, version creation, and job submission.

For a full happy-path validation (including worker processing and composite artifact verification), run:

```bash
make iur-happy-path
```

## Manual UI Validation

1. Start services:

```bash
make db-up
make db-migrate
pnpm run dev:api
pnpm run dev:worker
pnpm run dev:web
```

2. In the browser:

- Create project and scene from project/scene list pages.
- In editor, add objects and prompts.
- Click `Generate Wireframe`, `Render Object`, and `Generate Composite`.
- Use `Save Scene` and `Save Version`.
- Reload the page and confirm state is restored.

## Known Limits

- Current scene lists are API-driven but assume a local single-user workflow.
- Worker still uses local adapters by default unless configured otherwise.
- Composite quality depends on available object artifacts and adapter outputs.
