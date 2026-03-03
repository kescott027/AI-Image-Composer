ARCHITECTURE OVERVIEW

Front end (React)

Canvas compositor (the “editor”)

Layers panel (background/terrain layer, object wireframes, object renders, masks, final composite)

Object transform tools (move/rotate/scale, z-order)

Per-layer chat / instruction panel (object prompt refinement; “rotate 20° left”; “turn head toward painting”)

Conflict resolution UI (when constraints clash)

Scene Graph inspector (optional but very useful)

Shows objects and relations: “Person_1 faces Painting_1”, “Lamp_1 above Table_1”

Generation queue / job panel

Shows pending sketch jobs, object render jobs, final composite jobs, with versions

UI control layer (still in frontend, but separate module)

State machine / orchestration

“Overarching prompt” → “Block background” → “Create object wireframes” → “Finalize placements” → “Render objects” → “Composite zones”

Command system for edits (undo/redo)

Deterministic “SceneSpec” builder

Every UI action updates the same canonical spec that the backend uses

Python API layer (FastAPI is the obvious fit)
Split the API into two conceptual parts:

Data API (source of truth)

Projects, scenes, layers, objects, relations, prompts, version history

Auth, rate limiting, storage

ML Orchestration API (jobs + routing)

Submit generation jobs (sketch/object/final composite)

Manage GPU workers (local or remote)

Caching and reuse (same request → same artifact)

Streaming progress / websockets updates

ML backend (can be multiple services/processes)

Sketch model service (fast, low-res, wireframe-ish)

Returns: a transparent PNG + optional vector-ish representation (edges / keypoints) + a mask

Object render service (higher quality per object)

Inputs: object prompt + overarching prompt + object constraints + pose/rotation + local context relations

Returns: RGBA object render + mask + optional depth/normal (future)

Scene / zone compositor service (final)

Inputs: full SceneSpec, background layer, placed object renders, masks, zone definitions, relation groupings

Returns: final image + metadata

Storage / database
You do want two “stores” conceptually:

Relational DB (Postgres)

Your canonical scene graph, versions, relations, job records, provenance

Artifact store (files)

Local filesystem for dev; S3-compatible later (MinIO works locally)

Stores PNGs, masks, thumbnails, intermediate tiles, etc.

You do not need a separate graph database initially. Postgres handles relations fine. If later you want graph querying (path queries, rule evaluation), you can add either:

Postgres recursive queries + good indexing (often enough), or

a graph DB (Neo4j) only once you’re sure you need it.

CORE DATA MODEL (DESIGN THIS EARLY)

Key idea: everything is represented as a SceneSpec (JSON) that is versioned. Prompts are part of the spec, not “free-floating”.

Entities (tables)

project

id, name, created_at

scene

id, project_id, title, overarching_prompt, style_preset, seed_policy, created_at

scene_version

id, scene_id, version_number, scene_spec_json, created_at

(MVP: store full snapshots; later: diffs)

layer

id, scene_id, type: BACKGROUND | OBJECT | MASK | COMPOSITE | ZONE

order_index, visible, locked

object

id, scene_id, layer_id (object layer)

name, object_prompt, negative_prompt

transform: x,y,scale,rotation,z

anchor/pose fields (optional)

status: WIREFRAME_ONLY | RENDERED | LOCKED

relation

id, scene_id

subject_object_id, predicate, object_object_id

strength (0..1), notes

examples: faces, holds, above, behind, looking_at, near, attached_to

generation_job

id, scene_id, job_type: SKETCH | OBJECT_RENDER | FINAL_COMPOSITE | TILE

status, priority, input_hash, input_json, output_artifact_ids, logs, started_at, finished_at

artifact

id, scene_id, type: IMAGE | MASK | THUMBNAIL | DEPTH | NORMAL | TILE

uri/path, width, height, format, metadata_json, created_at

constraint (optional in MVP, but useful)

id, scene_id, scope: SCENE | LAYER | OBJECT

constraint_json (e.g., “Object_1 faces Object_2”, “Object_3 must be left of Object_4”)

SceneSpec JSON (what Codex should code against)

overarching_prompt

style_preset

layers: [{id, type, order, ...}]

objects: [{id, layer_id, prompt, transform, wireframe_artifact_id, render_artifact_id, …}]

relations: [{subject, predicate, object, strength}]

zones: [{id, polygon/rect, included_object_ids, guidance_prompt, …}]

generation_settings: model choices, seeds, steps, resolution, tile sizes

PHASED PLAN

PHASE 0: STRUCTURE AND FOUNDATIONS (1–2 weeks of work in practice, but do it now conceptually)
Goals: set up the repo, define SceneSpec, get end-to-end “create scene → save → render placeholder image”.

Frontend

React app skeleton + canvas with pan/zoom

Layer list UI (static)

SceneSpec state store (Zustand or Redux)

Undo/redo command pattern

Basic object rectangles (no ML yet)

Backend (Python)

FastAPI skeleton

Postgres schema + migrations (Alembic)

Artifact storage abstraction (local folder)

CRUD endpoints:

POST /projects, /scenes

GET/PUT scene spec

POST /artifacts (upload/register)

Job system scaffolding:

POST /jobs creates a record, returns id

Worker “stub” that marks jobs done with dummy outputs

ML

None yet (or a fake generator that returns a colored PNG so pipeline is proven)

Deliverable: you can place objects on canvas, save version, hit “generate” and receive a fake composite image. This de-risks 70% of your plumbing.

MVP: LAYERED WIREFRAMES + PLACED OBJECT RENDERS (first usable product)
Definition of “MVP” here: user can build a scene with background + multiple object wireframes, position them, regenerate wireframes, then generate per-object renders and composite into a single image. Relations exist but are “light” (mostly used as prompt injection).

Frontend

Overarching prompt editor (scene-level)

Background layer blocking tool (even if it’s just a coarse prompt + rough mask)

Object layer creation flow:

“Add object” → prompt → “Generate wireframe” → place/transform

Per-object chat instructions (simple command parsing)

Rotate, flip, change prompt, regenerate wireframe

Job panel (queue + progress updates via websocket/polling)

Backend

Job orchestration actually works:

SKETCH job: returns wireframe PNG + mask

OBJECT_RENDER job: returns RGBA render + mask

FINAL_COMPOSITE job: simple alpha compositing in correct z-order

Basic caching by input_hash (if unchanged SceneSpec → reuse artifacts)

ML services

Sketch model: pick something lightweight and fast

Could be edge-map generation, controlnet “scribble-like” pipeline, or a custom lightweight model

Don’t over-invest: speed matters more than beauty for wireframes

Object render model:

Stable Diffusion / SDXL with transparent background techniques + mask conditioning

Input includes: object prompt + overarching prompt + “relation hints” text

Database

Relations stored, but used minimally:

Example: “Person_1 faces Painting_1” → append “facing the painting” to Person_1 prompt, and “in front of person looking at it” to Painting_1 prompt.

Deliverable: A user can create layered objects and get a coherent composite quickly. This is already differentiated from pure text-to-image.

PHASE 2: CONFLICTS, CONSTRAINTS, AND BETTER RELATIONS (make it feel “smart”)
Goal: the system notices contradictions and asks.

Add a constraint engine (rule-based at first)

Define constraints in structured form

“Person_1 faces Painting_1”

“Person_1 is left_of Painting_1”

When user rotates/moves an object, recompute constraint satisfaction

If violation:

show an alert and propose fixes (“Rotate Person_1 30° right?” “Move Painting_1 to the right?”)

Prompt compiler

Instead of ad-hoc string concat, compile prompts from:

overarching prompt

object prompt

satisfied relations converted into text fragments

negative constraints

Better masks and occlusion

Track object depth ordering

Optional “occluder” masks

PHASE 3: ZONE-BASED GENERATION (your “final generator breaks image into zones” vision)
Goal: stop doing naive alpha compositing and start generating coherent regions using grouped relations.

Zone definition

Auto zone generation:

bounding boxes / Voronoi around objects

plus background remainder

Manual zone editing UI (paint/lasso region)

Zone job pipeline

For each zone:

Collect objects intersecting zone

Collect relations among those objects

Generate zone image conditioned on:

background hint

object masks / sketches

relation text

Stitch zones

feathering + seam reduction

optional “refinement pass” over whole image at low strength

This is where you likely want a compositing/refinement model rather than a single pass.

PHASE 4: PRO QUALITY FEATURES (what makes it a “product”, not a demo)

Version graph + branching (try variations without losing work)

Reproducibility controls (seeds per object/zone)

Asset library (save a rendered object as reusable)

Collaboration (shared projects)

Plugin model for ML backends (swap sketch model / render model / compositor)

Performance: GPU worker pool, batching, async websockets, incremental renders

SUGGESTED TECH STACK (PRAGMATIC)

Frontend

React + TypeScript

Canvas: Konva.js or PixiJS (Konva is great for editor-like UX)

State: Zustand

Networking: fetch + websocket

UI: whatever you like, but keep it utilitarian early

Backend

FastAPI

Postgres + SQLAlchemy + Alembic

Redis (jobs queue + pubsub) if you want scalable workers

Celery/RQ/Arq for job processing, or a custom asyncio worker to start

Artifacts

Local filesystem for dev

MinIO for “local S3” later

ML runtime

Separate process/services per model type

Simple HTTP/gRPC between orchestrator and model services

A unified “model adapter” interface so you can swap pipelines

WHAT TO HAND TO CODEX (SO IT CAN START CODING USEFULLY)

Define SceneSpec JSON schema first (even informal). Codex can scaffold types from it.

Create backend endpoints around that spec:

create scene, get scene, update scene, create job, job status, artifact retrieval

Implement frontend that edits SceneSpec and calls those endpoints.

Add a “fake” model adapter that returns dummy images, then swap to real models.

If you want, I can write you a concrete folder structure (monorepo layout), the initial SceneSpec TypeScript types + Pydantic models, and a minimal set of FastAPI routes that match your phases. That’s usually the fastest thing to drop into Codex and start iterating.