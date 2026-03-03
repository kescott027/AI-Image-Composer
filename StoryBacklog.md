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

### 6. [DONE] Implement Core CRUD for Projects and Scenes
**Deliverable:**
API endpoints:
- Create/list projects
- Create/get/update scenes
- Save/load SceneSpec
- Create scene versions
- Basic validation

---

### 7. [DONE] Implement Job System Scaffolding (No ML Yet)
**Deliverable:**
- Create job endpoint
- Poll job status endpoint
- Worker process that:
  - Claims jobs
  - Marks them complete
  - Writes job records to DB

---

### 8. [DONE] Implement Fake Generator Adapters (Pipeline Proof)
**Deliverable:**
Worker generates placeholder PNG outputs for:
- SKETCH
- OBJECT_RENDER
- FINAL_COMPOSITE

This proves end-to-end plumbing works.

---

## MVP – Initial Usable Release

### 9. [DONE] Build Web App Shell and Routing
**Deliverable:**
React app with routes:
- Project list
- Scene list
- Scene editor

Basic layout: left panel / canvas / right panel.

---

### 10. [DONE] Implement SceneSpec State Store and Undo/Redo
**Deliverable:**
Frontend state management:
- Canonical SceneSpec object
- Command-based updates
- Undo/redo support

---

### 11. [DONE] Implement Canvas Editor Core
**Deliverable:**
Canvas with:
- Pan / zoom
- Selection
- Rendering layers from SceneSpec

---

### 12. [DONE] Implement Layers Panel
**Deliverable:**
UI to:
- Create layers
- Toggle visibility
- Lock layers
- Reorder layers

---

### 13. [DONE] Implement Object Creation and Transform Tools
**Deliverable:**
- “Add object” action
- Move / rotate / scale
- Z-order within layer
- Persist transforms in SceneSpec

---

### 14. [DONE] Implement Overarching Prompt Editor
**Deliverable:**
Scene-level prompt editor stored in SceneSpec and versioned.

---

### 15. [DONE] Implement Per-Object Prompt Editor
**Deliverable:**
Each object supports:
- Prompt
- Negative prompt
- Persisted in SceneSpec

---

### 16. [DONE] Implement Generation Job Submission from UI
**Deliverable:**
Buttons for:
- Generate wireframe
- Render object
- Generate composite

UI calls backend to create jobs.

---

### 17. [DONE] Implement Job Status UI
**Deliverable:**
Job queue panel:
- Active jobs
- Completed jobs
- Failed jobs
- Logs/errors
- Artifact links

---

### 18. [DONE] Implement Wireframe Artifact Rendering
**Deliverable:**
When SKETCH job completes:
- Wireframe image appears in correct layer
- Follows object transform

---

### 19. [DONE] Implement Object Render Artifact Rendering
**Deliverable:**
When OBJECT_RENDER job completes:
- RGBA image displayed correctly
- Respects z-order and transforms

---

### 20. [DONE] Implement Simple Final Composite Generation
**Deliverable:**
FINAL_COMPOSITE job:
- Alpha-composite of layers
- Displayed as top layer
- Toggle on/off in UI

---

### 21. [DONE] Implement Scene Versioning (Save Points)
**Deliverable:**
- “Save version” action
- List prior versions
- Restore previous version

---

### 22. [DONE] Implement Relations Data Model and Basic UI
**Deliverable:**
Ability to create relations:
- faces
- left_of
- above
- near

Relations stored in SceneSpec and persisted.

---

### 23. [DONE] Implement Relation-Aware Prompt Compilation
**Deliverable:**
Backend prompt compiler merges:
- Overarching prompt
- Object prompt
- Relation hints
- Negative constraints

Used when generating jobs.

---

## Initial Usable Release (IUR)

### 24. [DONE] Package Initial Usable Release
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

### 25. [DONE] Replace Fake Sketch Adapter with Real Model
**Deliverable:**
- Integrate lightweight sketch model
- Maintain adapter interface
- Document setup instructions

---

### 26. [DONE] Replace Fake Object Render Adapter with Real Model
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

# Stories 31–50 – Post-Zone Generation Expansion

These stories extend the system beyond Phase 3 (zone-based generation) and move toward performance, extensibility, collaboration, and production-readiness.

---

## Phase 4 – Performance, Reproducibility, and Asset Systems

### 31. Implement Deterministic Seed Control Per Object and Zone
**Deliverable:**
- Each object and zone can optionally define a fixed seed.
- Seed stored in SceneSpec.
- Regeneration with same seed produces reproducible output.
- UI toggle for “lock seed”.

---

### 32. Implement Input Hash Caching Layer
**Deliverable:**
- Hash SceneSpec + job params.
- If identical job already completed, return cached artifact.
- Avoid duplicate ML execution.

---

### 33. Implement Artifact Version Browser
**Deliverable:**
- Per-object render history view.
- Ability to switch between previous wireframe/render versions.
- No artifact overwrites; version metadata visible.

---

### 34. Implement Asset Library (Save Object as Reusable Asset)
**Deliverable:**
- Save rendered object + prompt + metadata as reusable asset.
- Asset table in DB.
- UI to insert saved assets into new scenes.

---

### 35. Implement Background Generation as Independent Layer Type
**Deliverable:**
- Dedicated background generation job.
- Background-specific prompt and negative prompt.
- Independent regeneration without affecting objects.

---

## Phase 5 – Constraint Engine & Scene Intelligence

### 36. Implement Hard Constraint Blocking
**Deliverable:**
- HARD constraints prevent generation if violated.
- UI highlights violating objects/relations.
- Clear resolution options provided.

---

### 37. Implement Automatic Relation-Based Transform Suggestions
**Deliverable:**
- When user creates a relation (e.g., FACES), system suggests transform updates.
- Accept/reject interaction.
- Non-destructive preview.

---

### 38. Implement Spatial Conflict Detection (Overlap / Occlusion Warnings)
**Deliverable:**
- Detect severe object overlap or impossible depth ordering.
- Surface warnings in UI.
- Optional auto-fix suggestion.

---

### 39. Implement Basic Depth Ordering Model
**Deliverable:**
- Optional depth map per object.
- Store depth artifacts.
- Composite respects depth ordering rather than z-index alone.

---

### 40. Implement Relation Graph Visualization Panel
**Deliverable:**
- Visual node-edge graph view of objects and relations.
- Click-to-focus object.
- Relation editing from graph.

---

## Phase 6 – Performance & Scalability

### 41. Implement Redis-Based Job Queue
**Deliverable:**
- Replace simple polling queue with Redis-backed queue.
- Worker concurrency support.
- Retry policy for failed jobs.

---

### 42. Implement Multi-Worker GPU Scaling
**Deliverable:**
- Workers register capabilities (sketch, render, zone).
- API routes jobs based on capability.
- Horizontal scalability tested.

---

### 43. Implement Streaming Progress Updates via WebSockets
**Deliverable:**
- Real-time job updates.
- Partial progress logs.
- UI progress bars per job.

---

### 44. Implement Tile-Based Large Canvas Rendering
**Deliverable:**
- Split large canvases into tiles.
- TILE_RENDER job type.
- Seam-aware stitching.

---

### 45. Implement Low-Resolution Preview Mode
**Deliverable:**
- Quick preview generation with reduced resolution/steps.
- Toggle in UI.
- Promotes rapid iteration before full render.

---

## Phase 7 – Refinement and Quality Enhancements

### 46. Implement Global Refinement Pass with Adjustable Strength
**Deliverable:**
- REFINE job type.
- Strength parameter.
- Applies controlled coherence improvement across final composite.

---

### 47. Implement Mask Editing Tool (Manual Refinement)
**Deliverable:**
- Brush-based mask editor.
- Edit object or zone masks.
- Persist edited masks as artifacts.

---

### 48. Implement Style Preset System
**Deliverable:**
- Save and apply style presets.
- Stored in DB.
- Preset includes prompt modifiers + model params.

---

### 49. Implement Scene Branching and Variant Management
**Deliverable:**
- Branch scene from any version.
- Track parent-child lineage.
- UI switch between branches.

---

### 50. Implement Export System (Production Output)
**Deliverable:**
- Export final image in multiple formats.
- Include metadata JSON export (SceneSpec snapshot).
- Optional packaged project archive (.zip).

---

# Outcome After Story 50

At this point, the system supports:

- Structured scene editing
- Relation-aware object generation
- Zone-based rendering
- Deterministic reproduction
- Scalable job orchestration
- Asset reuse
- Branching workflows
- Production export capability

# Stories 51–100 – Platform-Oriented Roadmap

---

## Phase 8 – Platform Core (Extensibility First)

### 51. Formalize Model Adapter Interface (Stable Contract v1)
**Deliverable:**
- Abstract base adapter interface (sketch, object, zone, composite, refine)
- Typed input/output contracts
- Strict validation layer
- Adapter registry system

---

### 52. Implement Adapter Plugin Loading System
**Deliverable:**
- Dynamically load adapters from registered modules
- Adapter discovery via configuration
- Failure isolation for misbehaving adapters

---

### 53. Implement Adapter Capability Registration
**Deliverable:**
- Adapters declare supported job types
- Workers advertise capabilities
- API routes jobs based on capability

---

### 54. Implement Adapter Versioning & Compatibility Checks
**Deliverable:**
- Adapter version stored in job input
- Compatibility validation on scene load
- Migration hooks for adapter upgrades

---

### 55. Implement Adapter Sandbox Execution Boundary
**Deliverable:**
- Execute adapters in isolated process boundary
- Timeout and memory guardrails
- Prevent adapter crashes from affecting workers

---

## Phase 9 – Reproducibility & Determinism

### 56. Full Deterministic Generation Contract
**Deliverable:**
- Log seed, model version, adapter version, params per job
- Hash-based reproducibility validation
- Deterministic job replay guarantee

---

### 57. Implement SceneSpec Migration System
**Deliverable:**
- Versioned schema migrations
- Automatic upgrade on load
- Backward compatibility validation

---

### 58. Implement Artifact Integrity Verification
**Deliverable:**
- Hash artifacts on write
- Verify integrity on load
- Corruption detection handling

---

### 59. Implement Job Replay Mechanism
**Deliverable:**
- Replay historical job using stored inputs
- Compare outputs via hash
- Reproducibility verification tooling

---

### 60. Implement Immutable Artifact Storage Mode
**Deliverable:**
- Write-once artifact storage policy
- Prevent overwrite behavior
- Enforce artifact immutability

---

## Phase 10 – Scalable Infrastructure

### 61. Multi-Queue Priority System
**Deliverable:**
- High / normal / low job queues
- Preemption strategy
- Background vs interactive job distinction

---

### 62. Distributed Worker Coordination
**Deliverable:**
- Worker registration table
- Heartbeat monitoring
- Automatic failover handling

---

### 63. Horizontal Scaling Test Harness
**Deliverable:**
- Load test scenarios
- Synthetic job bursts
- Performance benchmarks documented

---

### 64. Persistent WebSocket Gateway Service
**Deliverable:**
- Dedicated WebSocket service
- Scalable pub/sub messaging
- Real-time job progress updates

---

### 65. Metrics and Observability Layer
**Deliverable:**
- Job duration metrics
- Adapter performance metrics
- Error tracking
- Prometheus/Grafana integration

---

## Phase 11 – Asset Ecosystem

### 66. Global Asset Repository
**Deliverable:**
- Cross-project asset library
- Tag-based search
- Asset reuse workflows

---

### 67. Asset Dependency Tracking
**Deliverable:**
- Scene-to-asset dependency graph
- Safe deletion validation
- Impact analysis before removal

---

### 68. Import/Export Scene Package Format
**Deliverable:**
- Portable `.scene` package format
- Includes SceneSpec + artifacts
- Adapter compatibility metadata

---

### 69. Asset Metadata Enrichment
**Deliverable:**
- Semantic tags
- Embedding vectors
- Relation templates for reuse

---

### 70. Asset Marketplace-Ready Metadata Structure
**Deliverable:**
- License metadata fields
- Attribution support
- Commercial usage flags

---

## Phase 12 – Collaboration Platform

### 71. Multi-User Authentication System
**Deliverable:**
- User accounts
- Secure authentication
- Project ownership model

---

### 72. Role-Based Access Control
**Deliverable:**
- Roles: Owner, Editor, Viewer
- Permission enforcement at API layer

---

### 73. Real-Time Collaborative Scene Editing
**Deliverable:**
- CRDT or operational transform sync model
- Conflict resolution handling
- Live multi-user editing

---

### 74. Commenting and Annotation System
**Deliverable:**
- Comments attached to scene/object/zone
- Threaded discussion support

---

### 75. Activity Log & Audit Trail
**Deliverable:**
- Record all scene modifications
- User attribution
- Time-based navigation

---

## Phase 13 – Developer Ecosystem

### 76. Public REST API Documentation Portal
**Deliverable:**
- Published OpenAPI docs
- Example workflows
- Authentication documentation

---

### 77. TypeScript SDK
**Deliverable:**
- API wrapper
- SceneSpec helpers
- Job submission utilities

---

### 78. Python SDK
**Deliverable:**
- Python client
- Batch generation utilities
- Scene creation helpers

---

### 79. Webhook System
**Deliverable:**
- Event-based notifications
- Job completion callbacks
- Artifact creation events

---

### 80. Plugin Marketplace Architecture
**Deliverable:**
- Adapter registry model
- Plugin signature verification
- Installation management framework

---

## Phase 14 – Advanced Scene Intelligence

### 81. Embedding-Based Relation Suggestion
**Deliverable:**
- Suggest possible relations between objects
- Context-aware hints based on embeddings

---

### 82. Semantic Scene Validator
**Deliverable:**
- Detect contradictory prompts
- Flag conflicting relations
- Provide confidence scoring

---

### 83. Automatic Zone Suggestion Engine
**Deliverable:**
- Suggest zones based on object clusters
- Editable by user

---

### 84. Lighting Context Engine
**Deliverable:**
- Track light source objects
- Influence object rendering
- Store light metadata in SceneSpec

---

### 85. Global Scene Reasoning Pass
**Deliverable:**
- Structured reasoning layer
- Relation consistency scoring
- Suggest corrective actions

---

## Phase 15 – Production & Commercialization Readiness

### 86. Billing Infrastructure Hooks
**Deliverable:**
- Usage tracking per job
- Metering system
- Cost attribution fields

---

### 87. Rate Limiting & Abuse Protection
**Deliverable:**
- Per-user rate limits
- Burst control
- API quotas

---

### 88. Project Archiving System
**Deliverable:**
- Cold storage support
- Archive and restore flow

---

### 89. Automated Backup & Restore
**Deliverable:**
- Scheduled backups
- Recovery workflow documentation

---

### 90. Compliance-Ready Logging
**Deliverable:**
- Structured logging
- Retention policies
- Audit export functionality

---

## Phase 16 – Long-Term Platform Capabilities

### 91. Multi-Backend Rendering Support (Local + Cloud Hybrid)
**Deliverable:**
- Dynamic backend selection
- Cost-based routing
- Fallback handling

---

### 92. Cross-Scene Object Referencing
**Deliverable:**
- Shared object instances across scenes
- Linked update propagation

---

### 93. Scene Template System
**Deliverable:**
- Prebuilt structured templates
- Template metadata schema

---

### 94. AI-Assisted Scene Bootstrapping
**Deliverable:**
- Generate initial SceneSpec from high-level description
- Editable structured draft output

---

### 95. Procedural Rule Engine
**Deliverable:**
- Rule DSL
- Auto-generate relations
- Layout adjustments from rules

---

### 96. Material System Layer
**Deliverable:**
- Object material metadata
- Shared material presets

---

### 97. Physics-Informed Placement
**Deliverable:**
- Basic collision rules
- Gravity alignment
- Structural consistency checks

---

### 98. Render History Graph Visualization
**Deliverable:**
- Visual graph of render lineage
- Branch and merge representation

---

### 99. Enterprise Deployment Mode
**Deliverable:**
- Configurable storage backends
- External identity provider integration
- Deployment documentation

---

### 100. Platform Stability Milestone (v1.0)
**Deliverable:**
- Stable adapter contract
- Stable SceneSpec schema
- Public API freeze
- Documentation complete
- Performance benchmarks met
