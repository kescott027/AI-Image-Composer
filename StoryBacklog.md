# Multi-Layer Image Composer – Reprioritized Story Backlog

This backlog is reordered into release epics with security and architecture hardening prioritized, while carving out a near-term usability release for guided 3-layer generation.

Status legend:

- `[DONE]`
- `[IN PROGRESS]`
- `[NOT STARTED]`

## Epic 1: MVP (Release 0)

Goal: usable scene composer with layered editing, generation flow, persistence, and basic constraints.

1. **Story 1** `[DONE]` Define Product Framing and Milestones
2. **Story 2** `[DONE]` Create Monorepo Skeleton (Frontend + Backend + Workers)
3. **Story 3** `[DONE]` Define Canonical SceneSpec and API Contracts
4. **Story 4** `[DONE]` Implement Persistent Storage Foundation (Postgres + Migrations)
5. **Story 5** `[DONE]` Implement Artifact Storage Abstraction (Local First)
6. **Story 6** `[DONE]` Implement Core CRUD for Projects and Scenes
7. **Story 7** `[DONE]` Implement Job System Scaffolding (No ML Yet)
8. **Story 8** `[DONE]` Implement Fake Generator Adapters (Pipeline Proof)
9. **Story 9** `[DONE]` Build Web App Shell and Routing
10. **Story 10** `[DONE]` Implement SceneSpec State Store and Undo/Redo
11. **Story 11** `[DONE]` Implement Canvas Editor Core
12. **Story 12** `[DONE]` Implement Layers Panel
13. **Story 13** `[DONE]` Implement Object Creation and Transform Tools
14. **Story 14** `[DONE]` Implement Overarching Prompt Editor
15. **Story 15** `[DONE]` Implement Per-Object Prompt Editor
16. **Story 16** `[DONE]` Implement Generation Job Submission from UI
17. **Story 17** `[DONE]` Implement Job Status UI
18. **Story 18** `[DONE]` Implement Wireframe Artifact Rendering
19. **Story 19** `[DONE]` Implement Object Render Artifact Rendering
20. **Story 20** `[DONE]` Implement Simple Final Composite Generation
21. **Story 21** `[DONE]` Implement Scene Versioning (Save Points)
22. **Story 22** `[DONE]` Implement Relations Data Model and Basic UI
23. **Story 23** `[DONE]` Implement Relation-Aware Prompt Compilation
24. **Story 24** `[DONE]` Package Initial Usable Release
25. **Story 25** `[DONE]` Replace Fake Sketch Adapter with Real Model
26. **Story 26** `[DONE]` Replace Fake Object Render Adapter with Real Model
27. **Story 27** `[DONE]` Add Relation Conflict Detection
28. **Story 28** `[DONE]` Implement Manual Zone Definition
29. **Story 29** `[DONE]` Implement Zone-Based Generation Pipeline
30. **Story 30** `[DONE]` Add Refinement Pass / Seam Reduction

---

## Epic 1A: Directed Three-Layer Compose Flow (Release 0.5 - Next Break)

Goal: deliver a production-feeling user flow to build a cohesive 3-layer scene end-to-end:
project -> overarching prompt -> blocking layer -> object wireframes (iterate/select) -> place/anchor -> layered render -> unified final image.

### Prerequisites for This Break

1. **Story 107** `[IN PROGRESS]` must be completed (stable app lifecycle: start/stop/status/logs).
2. Local/API/worker happy-path validation must remain green (`make iur-happy-path`).
3. Real adapter operating mode must be pinned for this break (fake-only, real-only, or hybrid fallback).
4. SceneSpec fields for anchor and candidate variants must be finalized before UI implementation begins.

### Stories for the Requested User Path

1. **Story 113** `[IN PROGRESS]` Guided Project Bootstrap Flow (new project + overarching prompt first-run path)
2. **Story 114** `[IN PROGRESS]` Blocking Layer Generation from Overarching Prompt (single action + regenerable)
3. **Story 115** `[IN PROGRESS]` Entity/Object Creation Presets (person, table, cake + freeform object type)
4. **Story 116** `[IN PROGRESS]` Object Wireframe Generation per Object Prompt on New Layer
5. **Story 117** `[IN PROGRESS]` One-Button Wireframe Regeneration Cycle (quick cycle 2-5 passes)
6. **Story 118** `[IN PROGRESS]` Multi-Variant Wireframe Batch Generation (`n` candidates) + Candidate Picker
7. **Story 119** `[IN PROGRESS]` Drag/Place Workflow with Explicit Anchor Action
8. **Story 120** `[IN PROGRESS]` Anchor Semantics Enforcement (anchored objects remain fixed during regenerate/render)
9. **Story 121** `[IN PROGRESS]` Ordered Layer Render Orchestrator (bottom-to-top render queue from current scene state)
10. **Story 122** `[IN PROGRESS]` Per-Layer Render Progress + Retry UX (clear status, fail/retry per object)
11. **Story 123** `[IN PROGRESS]` Unified Composite Pass (global consistency using overarching prompt context)
12. **Story 124** `[DONE]` Palette and Style Harmonization Controls (color consistency knobs + defaults)
13. **Story 125** `[DONE]` End-to-End Acceptance Scenario: Person + Table + Birthday Cake
14. **Story 126** `[NOT STARTED]` Release 0.5 UX Readiness Pass (professional polish, error states, loading states)

### Decision Points (Must Resolve Before Story 116/118/120)

1. Wireframe variant retention policy: how many variants persist per object and for how long.
2. Anchor strictness: hard-lock position only, or lock position + scale + rotation.
3. Regeneration behavior on anchored object: update pixels in place only vs allow optional offset suggestions.
4. Blocking layer artifact type: wireframe-like structure, grayscale composition map, or full rough paint pass.
5. Unified composite strategy: deterministic non-ML blend first vs optional ML refinement always-on.

### Next Break Execution Order (Recommended)

1. Foundation slice: Stories 113-116
2. Iteration slice: Stories 117-120
3. Rendering slice: Stories 121-124
4. Release validation slice: Stories 125-126

Exit criterion for Release 0.5:

- A user can create a scene with person/table/cake, generate/select wireframes, place + anchor each object, render bottom-to-top layers, and produce a cohesive final composite in one continuous session.

---

## Epic 2: Production Ready (Release 1)

Goal: security-first hardening, architecture hardening, reproducibility, observability, and operational reliability.

### Security and Architecture Hardening (Highest Priority)

1. **Story 71** `[NOT STARTED]` Multi-User Authentication System
2. **Story 72** `[NOT STARTED]` Role-Based Access Control
3. **Story 87** `[NOT STARTED]` Rate Limiting & Abuse Protection
4. **Story 90** `[NOT STARTED]` Compliance-Ready Logging
5. **Story 105** `[NOT STARTED]` Secrets Management and Key Rotation Baseline
6. **Story 106** `[NOT STARTED]` Dependency/Container Hardening (SBOM + Signed Images)
7. **Story 58** `[NOT STARTED]` Implement Artifact Integrity Verification
8. **Story 60** `[NOT STARTED]` Implement Immutable Artifact Storage Mode
9. **Story 89** `[NOT STARTED]` Automated Backup & Restore
10. **Story 88** `[NOT STARTED]` Project Archiving System

### Core Architecture Stability

11. **Story 101** `[NOT STARTED]` Enforce Single-Source SceneSpec Contract (generated TS/Pydantic/OpenAPI)
12. **Story 57** `[NOT STARTED]` Implement SceneSpec Migration System
13. **Story 102** `[NOT STARTED]` Split Draft Save vs Version Checkpoint Model
14. **Story 31** `[NOT STARTED]` Implement Deterministic Seed Control Per Object and Zone
15. **Story 32** `[NOT STARTED]` Implement Input Hash Caching Layer
16. **Story 56** `[NOT STARTED]` Full Deterministic Generation Contract
17. **Story 59** `[NOT STARTED]` Implement Job Replay Mechanism

### Queue, Worker, and Runtime Reliability

18. **Story 41** `[NOT STARTED]` Implement Redis-Based Job Queue
19. **Story 103** `[NOT STARTED]` Atomic Job Claiming + Retry + Dead-Letter Policy
20. **Story 62** `[NOT STARTED]` Distributed Worker Coordination
21. **Story 61** `[NOT STARTED]` Multi-Queue Priority System
22. **Story 55** `[NOT STARTED]` Implement Adapter Sandbox Execution Boundary
23. **Story 54** `[NOT STARTED]` Implement Adapter Versioning & Compatibility Checks
24. **Story 65** `[NOT STARTED]` Metrics and Observability Layer
25. **Story 63** `[NOT STARTED]` Horizontal Scaling Test Harness
26. **Story 104** `[NOT STARTED]` CI Integration Harness (API + Worker + DB + IUR Smoke)

### Production UX and Integration Readiness

27. **Story 64** `[NOT STARTED]` Persistent WebSocket Gateway Service
28. **Story 43** `[NOT STARTED]` Streaming Progress Updates via WebSockets
29. **Story 79** `[NOT STARTED]` Webhook System
30. **Story 107** `[IN PROGRESS]` AIIC Process Manager UX (Background Start/Stop/Status/Logs as Primary Flow)
31. **Story 108** `[NOT STARTED]` Linux User-Service Packaging (`systemd --user` unit + enable/disable scripts)
32. **Story 109** `[NOT STARTED]` Desktop Launcher Packaging for Windows/macOS (taskbar/dock runnable app wrapper + clean shutdown)
33. **Story 110** `[NOT STARTED]` Managed Window Lifecycle Control (app menu Exit + optional shutdown-on-window-close policy)
34. **Story 111** `[NOT STARTED]` UI Theme System (Dark + Light Mode Support with User Toggle and Persistence)
35. **Story 112** `[NOT STARTED]` Release UI Polish Pass (Dark Mode Default, Professional Visual QA, Accessibility Contrast Checks)

---

## Epic 3: Stable Platform (Release 2)

Goal: extensible platform features, collaboration baseline, and robust content workflows.

1. **Story 33** `[NOT STARTED]` Implement Artifact Version Browser
2. **Story 34** `[NOT STARTED]` Implement Asset Library (Save Object as Reusable Asset)
3. **Story 35** `[NOT STARTED]` Implement Background Generation as Independent Layer Type
4. **Story 36** `[NOT STARTED]` Implement Hard Constraint Blocking
5. **Story 37** `[NOT STARTED]` Implement Automatic Relation-Based Transform Suggestions
6. **Story 38** `[NOT STARTED]` Implement Spatial Conflict Detection (Overlap / Occlusion Warnings)
7. **Story 39** `[NOT STARTED]` Implement Basic Depth Ordering Model
8. **Story 40** `[NOT STARTED]` Implement Relation Graph Visualization Panel
9. **Story 42** `[NOT STARTED]` Implement Multi-Worker GPU Scaling
10. **Story 44** `[NOT STARTED]` Implement Tile-Based Large Canvas Rendering
11. **Story 45** `[NOT STARTED]` Implement Low-Resolution Preview Mode
12. **Story 46** `[NOT STARTED]` Implement Global Refinement Pass with Adjustable Strength
13. **Story 47** `[NOT STARTED]` Implement Mask Editing Tool (Manual Refinement)
14. **Story 48** `[NOT STARTED]` Implement Style Preset System
15. **Story 49** `[NOT STARTED]` Implement Scene Branching and Variant Management
16. **Story 50** `[NOT STARTED]` Implement Export System (Production Output)
17. **Story 51** `[NOT STARTED]` Formalize Model Adapter Interface (Stable Contract v1)
18. **Story 52** `[NOT STARTED]` Implement Adapter Plugin Loading System
19. **Story 53** `[NOT STARTED]` Implement Adapter Capability Registration
20. **Story 66** `[NOT STARTED]` Global Asset Repository
21. **Story 67** `[NOT STARTED]` Asset Dependency Tracking
22. **Story 68** `[NOT STARTED]` Import/Export Scene Package Format
23. **Story 69** `[NOT STARTED]` Asset Metadata Enrichment
24. **Story 70** `[NOT STARTED]` Asset Marketplace-Ready Metadata Structure
25. **Story 73** `[NOT STARTED]` Real-Time Collaborative Scene Editing
26. **Story 74** `[NOT STARTED]` Commenting and Annotation System
27. **Story 75** `[NOT STARTED]` Activity Log & Audit Trail
28. **Story 76** `[NOT STARTED]` Public REST API Documentation Portal
29. **Story 77** `[NOT STARTED]` TypeScript SDK
30. **Story 78** `[NOT STARTED]` Python SDK
31. **Story 80** `[NOT STARTED]` Plugin Marketplace Architecture

---

## Epic 4: Ongoing Growth and Stability (Release n)

Goal: advanced intelligence, commercialization, and long-horizon platform resilience.

1. **Story 81** `[NOT STARTED]` Embedding-Based Relation Suggestion
2. **Story 82** `[NOT STARTED]` Semantic Scene Validator
3. **Story 83** `[NOT STARTED]` Automatic Zone Suggestion Engine
4. **Story 84** `[NOT STARTED]` Lighting Context Engine
5. **Story 85** `[NOT STARTED]` Global Scene Reasoning Pass
6. **Story 86** `[NOT STARTED]` Billing Infrastructure Hooks
7. **Story 91** `[NOT STARTED]` Multi-Backend Rendering Support (Local + Cloud Hybrid)
8. **Story 92** `[NOT STARTED]` Cross-Scene Object Referencing
9. **Story 93** `[NOT STARTED]` Scene Template System
10. **Story 94** `[NOT STARTED]` AI-Assisted Scene Bootstrapping
11. **Story 95** `[NOT STARTED]` Procedural Rule Engine
12. **Story 96** `[NOT STARTED]` Material System Layer
13. **Story 97** `[NOT STARTED]` Physics-Informed Placement
14. **Story 98** `[NOT STARTED]` Render History Graph Visualization
15. **Story 99** `[NOT STARTED]` Enterprise Deployment Mode
16. **Story 100** `[NOT STARTED]` Platform Stability Milestone (v1.0)

---

## Release Gate Notes

- **Release 0** is complete. Sign-off recorded in `docs/RELEASE_0_SIGNOFF.MD`.
- **Release 0.5** is the near-term guided 3-layer compose milestone (Epic 1A).
- **Release 1** must pass security hardening and architecture hardening gates before production traffic.
- **Release 2** focuses on stable extensibility and collaboration readiness.
- **Release n** is long-horizon growth and enterprise expansion.
