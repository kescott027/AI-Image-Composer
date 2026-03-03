# Multi-Layer Image Composer – Story List

## Phase 0 – Framing & Structural Foundations

### 1. [IN PROGRESS] Define Product Framing and Milestones
**Deliverable:**  
A short build plan document defining:
- Phase 0, MVP, Phase 2, Phase 3
- Clear “Definition of Done” for each phase
- Criteria for Initial Usable Release (IUR)

---

### 2. [DONE] Create Monorepo Skeleton (Frontend + Backend + Workers)
**Deliverable:**  
Suggested Repository structure:
```text 
/apps
/web (React frontend)
/api (FastAPI backend)
/worker (Job runner)
/packages
/shared (Shared types / schemas)
```
Includes:
- Root tooling (pnpm / poetry / uv)
- Basic README with local dev instructions

Includes:
- Root tooling (pnpm / poetry / uv)
- Basic README with local dev instructions

---

### 3. [DONE] Define Canonical SceneSpec and API Contracts
**Deliverable:**  
- `SceneSpec` JSON schema
- TypeScript types (frontend)
- Pydantic models (backend)
- OpenAPI schema exported from FastAPI

---

### 4. [DONE] Implement Persistent Storage Foundation (Postgres + Migrations)
**Deliverable:**  
Database schema and migrations for:
- projects
- scenes
- scene_versions
- layers
- objects
- relations
- jobs
- artifacts

Includes docker-compose for local Postgres.

---

### 5. [DONE] Implement Artifact Storage Abstraction (Local First)
**Deliverable:**  
Backend module to:
- Store images/masks/thumbnails locally
- Generate stable artifact URIs
- Retrieve artifacts via API endpoints

---

### 6. [NOT STARTED] Implement Core CRUD for Projects and Scenes
**Deliverable:**  
API endpoints:
- Create/list projects
- Create/get/update scenes
- Save/load SceneSpec
- Create scene versions
- Basic validation

---

### 7. [IN PROGRESS] Implement Job System Scaffolding (No ML Yet)
**Deliverable:**  
- Create job endpoint
- Poll job status endpoint
- Worker process that:
  - Claims jobs
  - Marks them complete
  - Writes job records to DB

---

### 8. [NOT STARTED] Implement Fake Generator Adapters (Pipeline Proof)
**Deliverable:**  
Worker generates placeholder PNG outputs for:
- SKETCH
- OBJECT_RENDER
- FINAL_COMPOSITE

This proves end-to-end plumbing works.

---

## MVP – Initial Usable Release

### 9. [IN PROGRESS] Build Web App Shell and Routing
**Deliverable:**  
React app with routes:
- Project list
- Scene list
- Scene editor

Basic layout: left panel / canvas / right panel.

---

### 10. [NOT STARTED] Implement SceneSpec State Store and Undo/Redo
**Deliverable:**  
Frontend state management:
- Canonical SceneSpec object
- Command-based updates
- Undo/redo support

---

### 11. [NOT STARTED] Implement Canvas Editor Core
**Deliverable:**  
Canvas with:
- Pan / zoom
- Selection
- Rendering layers from SceneSpec

---

### 12. [NOT STARTED] Implement Layers Panel
**Deliverable:**  
UI to:
- Create layers
- Toggle visibility
- Lock layers
- Reorder layers

---

### 13. [NOT STARTED] Implement Object Creation and Transform Tools
**Deliverable:**  
- “Add object” action
- Move / rotate / scale
- Z-order within layer
- Persist transforms in SceneSpec

---

### 14. [NOT STARTED] Implement Overarching Prompt Editor
**Deliverable:**  
Scene-level prompt editor stored in SceneSpec and versioned.

---

### 15. [NOT STARTED] Implement Per-Object Prompt Editor
**Deliverable:**  
Each object supports:
- Prompt
- Negative prompt
- Persisted in SceneSpec

---

### 16. [NOT STARTED] Implement Generation Job Submission from UI
**Deliverable:**  
Buttons for:
- Generate wireframe
- Render object
- Generate composite

UI calls backend to create jobs.

---

### 17. [NOT STARTED] Implement Job Status UI
**Deliverable:**  
Job queue panel:
- Active jobs
- Completed jobs
- Failed jobs
- Logs/errors
- Artifact links

---

### 18. [NOT STARTED] Implement Wireframe Artifact Rendering
**Deliverable:**  
When SKETCH job completes:
- Wireframe image appears in correct layer
- Follows object transform

---

### 19. [NOT STARTED] Implement Object Render Artifact Rendering
**Deliverable:**  
When OBJECT_RENDER job completes:
- RGBA image displayed correctly
- Respects z-order and transforms

---

### 20. [NOT STARTED] Implement Simple Final Composite Generation
**Deliverable:**  
FINAL_COMPOSITE job:
- Alpha-composite of layers
- Displayed as top layer
- Toggle on/off in UI

---

### 21. [NOT STARTED] Implement Scene Versioning (Save Points)
**Deliverable:**  
- “Save version” action
- List prior versions
- Restore previous version

---

### 22. [NOT STARTED] Implement Relations Data Model and Basic UI
**Deliverable:**  
Ability to create relations:
- faces
- left_of
- above
- near

Relations stored in SceneSpec and persisted.

---

### 23. [NOT STARTED] Implement Relation-Aware Prompt Compilation
**Deliverable:**  
Backend prompt compiler merges:
- Overarching prompt
- Object prompt
- Relation hints
- Negative constraints

Used when generating jobs.

---

## Initial Usable Release (IUR)

### 24. [NOT STARTED] Package Initial Usable Release
**Definition of Done:**  
A user can:
- Create a scene
- Set overarching prompt
- Add 2–5 objects
- Generate wireframes
- Position them
- Render objects
- Generate final composite
- Reload project later with all assets intact

Tag this release.

---

## Phase 2 – Constraint Awareness & Intelligence

### 25. [NOT STARTED] Replace Fake Sketch Adapter with Real Model
**Deliverable:**  
- Integrate lightweight sketch model
- Maintain adapter interface
- Document setup instructions

---

### 26. [NOT STARTED] Replace Fake Object Render Adapter with Real Model
**Deliverable:**  
- Integrate SD/SDXL-based object renderer
- Transparent background support
- Mask handling
- Document setup

---

### 27. [NOT STARTED] Add Relation Conflict Detection
**Deliverable:**  
Constraint engine that:
- Detects conflicting directional relations
- Surfaces UI warnings
- Suggests possible fixes

---

## Phase 3 – Zone-Based Generation

### 28. [NOT STARTED] Implement Manual Zone Definition
**Deliverable:**  
UI for:
- Rectangular/lasso zone drawing
- Store zones in SceneSpec
- Display zone overlays

---

### 29. [NOT STARTED] Implement Zone-Based Generation Pipeline
**Deliverable:**  
Backend:
- Break scene into zones
- Collect objects + relations per zone
- Generate zone images
- Stitch into final composite artifact

---

### 30. [NOT STARTED] Add Refinement Pass / Seam Reduction
**Deliverable:**  
Optional refinement job:
- Low-strength global pass
- Reduce seams
- Improve coherence
- Configurable in SceneSpec
