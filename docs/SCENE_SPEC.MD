# SceneSpec – Canonical Scene Graph for the Multi-Layer Image Composer

This document defines the canonical JSON structure (“SceneSpec”) that both the React UI and Python API use as the source of truth. All editor operations mutate this structure. All ML jobs consume a snapshot of this structure.

Design goals:
- Deterministic: the same spec + same settings should reproduce the same outputs.
- Versionable: store full snapshots early; evolve to diffs later.
- Extensible: add zones, constraints, depth, materials without breaking old projects.
- Portable: spec is self-contained; artifacts referenced by stable IDs.

---

## 1. Top-level structure

SceneSpec is a single JSON object.

Required fields:
- `schema_version`
- `scene`
- `layers`
- `objects`
- `relations`
- `artifacts`
- `jobs`

Optional (recommended):
- `zones`
- `constraints`
- `settings`
- `history`

---

## 2. SceneSpec JSON (reference shape)

```json
{
  "schema_version": "0.1.0",
  "scene": {
    "id": "scene_123",
    "title": "My Scene",
    "overarching_prompt": "A cozy cabin interior with warm sunlight.",
    "negative_prompt": "",
    "style_preset": "default",
    "created_at": "2026-03-02T12:00:00Z",
    "updated_at": "2026-03-02T12:00:00Z"
  },

  "settings": {
    "units": "px",
    "canvas": {
      "width": 1024,
      "height": 1024,
      "background_color": "transparent"
    },
    "defaults": {
      "seed_policy": "per_job",
      "sampler": "default",
      "steps": 30,
      "cfg_scale": 7.0
    },
    "models": {
      "sketch_adapter": "fake_sketch_v1",
      "object_render_adapter": "fake_object_v1",
      "composite_adapter": "simple_alpha_v1",
      "zone_adapter": "disabled"
    }
  },

  "layers": [
    {
      "id": "layer_bg",
      "type": "BACKGROUND",
      "name": "Background",
      "order": 0,
      "visible": true,
      "locked": false,
      "metadata": {}
    },
    {
      "id": "layer_objects",
      "type": "OBJECT",
      "name": "Objects",
      "order": 1,
      "visible": true,
      "locked": false,
      "metadata": {}
    },
    {
      "id": "layer_composite",
      "type": "COMPOSITE",
      "name": "Composite",
      "order": 999,
      "visible": true,
      "locked": true,
      "metadata": {}
    }
  ],

  "objects": [
    {
      "id": "obj_person_1",
      "layer_id": "layer_objects",
      "name": "Person 1",
      "kind": "character",
      "prompt": "a person wearing a red coat",
      "negative_prompt": "",
      "transform": {
        "x": 420,
        "y": 560,
        "scale_x": 1.0,
        "scale_y": 1.0,
        "rotation_deg": 0.0,
        "z_index": 10,
        "anchor": "center"
      },
      "wireframe": {
        "artifact_id": "art_wire_001",
        "mask_artifact_id": "art_mask_001",
        "version": 1
      },
      "render": {
        "artifact_id": "art_render_001",
        "mask_artifact_id": "art_rmask_001",
        "version": 1
      },
      "status": "WIREFRAME_ONLY",
      "metadata": {
        "tags": ["person"]
      }
    }
  ],

  "relations": [
    {
      "id": "rel_001",
      "subject_object_id": "obj_person_1",
      "predicate": "FACES",
      "object_object_id": "obj_painting_1",
      "strength": 0.8,
      "notes": ""
    }
  ],

  "zones": [
    {
      "id": "zone_001",
      "name": "Foreground cluster",
      "shape": {
        "type": "rect",
        "x": 300,
        "y": 400,
        "width": 500,
        "height": 450
      },
      "included_object_ids": ["obj_person_1"],
      "guidance_prompt": "",
      "negative_prompt": ""
    }
  ],

  "constraints": [
    {
      "id": "c_001",
      "scope": { "type": "RELATION", "relation_id": "rel_001" },
      "rule": "SOFT",
      "weight": 0.6,
      "message": "Person should face the painting."
    }
  ],

  "artifacts": [
    {
      "id": "art_wire_001",
      "type": "IMAGE",
      "subtype": "WIRE",
      "uri": "artifact://local/art_wire_001.png",
      "width": 512,
      "height": 512,
      "format": "png",
      "created_at": "2026-03-02T12:05:00Z",
      "metadata": {}
    }
  ],

  "jobs": [
    {
      "id": "job_001",
      "type": "SKETCH",
      "status": "SUCCEEDED",
      "created_at": "2026-03-02T12:04:30Z",
      "started_at": "2026-03-02T12:04:31Z",
      "finished_at": "2026-03-02T12:04:35Z",
      "input_hash": "sha256:...",
      "input": {
        "scene_version": 3,
        "target_object_id": "obj_person_1",
        "adapter": "fake_sketch_v1",
        "params": { "width": 512, "height": 512, "seed": 123 }
      },
      "outputs": {
        "primary_artifact_id": "art_wire_001",
        "mask_artifact_id": "art_mask_001"
      },
      "error": null,
      "logs": []
    }
  ],

  "history": {
    "scene_version": 3,
    "notes": ""
  }
}
3. Field definitions
3.1 schema_version (string)

Semver-like. Increment minor for backwards-compatible changes; major for breaking.

3.2 scene (object)

id (string)

title (string)

overarching_prompt (string)

negative_prompt (string, optional)

style_preset (string, optional)

created_at / updated_at (ISO string, optional)

3.3 settings (object, optional but recommended)

canvas.width, canvas.height (int)

defaults for generation (steps, cfg_scale, seed_policy, etc.)

models chooses adapters by name (sketch/object/composite/zone)

Keep settings stable over time. If you add a new field, default it in code when missing.

3.4 layers (array)

Layer types (string enum):

BACKGROUND

OBJECT

MASK (optional future)

COMPOSITE

ZONE (optional future if you treat zones as layers)

Layer fields:

id (string)

type (enum)

name (string)

order (int) (global ordering for UI)

visible (bool)

locked (bool)

metadata (object)

3.5 objects (array)

Object fields:

id (string)

layer_id (string) must exist in layers

name (string)

kind (string) (examples: character, prop, building, terrain)

prompt (string)

negative_prompt (string, optional)

transform (object):

x, y (number) canvas coordinates

scale_x, scale_y (number)

rotation_deg (number)

z_index (int) ordering inside the layer

anchor (string enum recommended: center, top_left, bottom_center, etc.)

wireframe (object, optional):

artifact_id (string)

mask_artifact_id (string, optional)

version (int)

render (object, optional):

artifact_id (string)

mask_artifact_id (string, optional)

version (int)

status (enum):

DRAFT

WIREFRAME_ONLY

RENDERED

LOCKED

metadata (object) freeform tags, hints, etc.

Notes:

Wireframe and render are references to artifacts. The editor should be able to display either (or both).

Keep transform always present (even if default).

3.6 relations (array)

Relation fields:

id

subject_object_id

predicate (enum)

object_object_id

strength (0..1)

notes (string)

Suggested predicate enum (start small, extend later):

FACES

LOOKING_AT

LEFT_OF

RIGHT_OF

ABOVE

BELOW

IN_FRONT_OF

BEHIND

NEAR

HOLDING

SITTING_ON

ATTACHED_TO

3.7 zones (array, optional)

Used in Phase 3 zone-based generation. Zone fields:

id, name

shape:

{ "type": "rect", "x":..., "y":..., "width":..., "height":... }

future: { "type": "polygon", "points": [[x,y], ...] }

included_object_ids (array)

guidance_prompt (string, optional)

negative_prompt (string, optional)

3.8 constraints (array, optional)

Constraints are separate from relations so you can represent “rules” that may not be directly a relation.
Fields:

id

scope:

{ "type": "SCENE" }

{ "type": "OBJECT", "object_id": "..." }

{ "type": "RELATION", "relation_id": "..." }

{ "type": "ZONE", "zone_id": "..." }

rule (enum):

HARD (must be satisfied; block generation or require user resolution)

SOFT (warn + downgrade strength)

weight (0..1)

message (string)

3.9 artifacts (array)

Artifacts represent stored files (images, masks, tiles, etc.)
Fields:

id

type (enum): IMAGE | MASK | THUMBNAIL | DEPTH | NORMAL | TILE

subtype (string, optional): e.g. WIRE, RENDER, COMPOSITE, ZONE

uri (string): artifact://... (your own scheme) or a URL

width, height (int)

format (string): png/webp/jpg

created_at (ISO string)

metadata (object): seeds, model, params, etc.

3.10 jobs (array)

Jobs are recorded to support UI progress and reproducibility.

Fields:

id

type (enum): SKETCH | OBJECT_RENDER | FINAL_COMPOSITE | ZONE_RENDER | TILE_RENDER | REFINE

status (enum): QUEUED | RUNNING | SUCCEEDED | FAILED | CANCELED

created_at, started_at, finished_at (ISO string)

input_hash (string) for caching

input (object) job payload (adapter, params, targets)

outputs (object) artifact references

error (string|null)

logs (array of strings)

4. Prompt compilation contract (MVP)

The backend should produce “compiled prompts” for each job type from:

Scene: overarching_prompt, negative_prompt, style_preset

Object: prompt, negative_prompt

Relations: convert relevant relations into short text hints (based on strength)

Zone: include zone guidance prompts if present

Minimum contract:

For SKETCH: compiled prompt should be short and object-focused.

For OBJECT_RENDER: compiled prompt includes overarching + object + relation hints.

For FINAL_COMPOSITE: compiled prompt includes overarching + global style.

Keep the compiled prompt output in job input.metadata or artifact metadata for reproducibility.

5. ID and versioning rules

IDs are strings. Prefer stable prefixes:

scene_*, layer_*, obj_*, rel_*, zone_*, job_*, art_*

Scene versioning:

Store a snapshot of SceneSpec per save point (Phase 0/MVP).

Add diffs later if needed.

When an object is regenerated:

Increment wireframe.version or render.version

Create new artifact IDs (do not overwrite files)

6. Minimal validation rules (MVP)

layer_id on objects must exist

subject_object_id and object_object_id must exist

z_index is integer; layer order is integer

artifact IDs referenced by objects/jobs should exist in artifacts (or be null if pending)

7. Recommended next step for implementation

Generate these code artifacts from this doc:

packages/shared/scenespec.ts (TS types + runtime validators)

apps/api/models/scenespec.py (Pydantic models)

A single “upsert SceneSpec” API route and a “get SceneSpec” route

Basic serializer/deserializer with schema_version migration hooks
3. Field definitions
3.1 schema_version (string)

Semver-like. Increment minor for backwards-compatible changes; major for breaking.

3.2 scene (object)

id (string)

title (string)

overarching_prompt (string)

negative_prompt (string, optional)

style_preset (string, optional)

created_at / updated_at (ISO string, optional)

3.3 settings (object, optional but recommended)

canvas.width, canvas.height (int)

defaults for generation (steps, cfg_scale, seed_policy, etc.)

models chooses adapters by name (sketch/object/composite/zone)

Keep settings stable over time. If you add a new field, default it in code when missing.

3.4 layers (array)

Layer types (string enum):

BACKGROUND

OBJECT

MASK (optional future)

COMPOSITE

ZONE (optional future if you treat zones as layers)

Layer fields:

id (string)

type (enum)

name (string)

order (int) (global ordering for UI)

visible (bool)

locked (bool)

metadata (object)

3.5 objects (array)

Object fields:

id (string)

layer_id (string) must exist in layers

name (string)

kind (string) (examples: character, prop, building, terrain)

prompt (string)

negative_prompt (string, optional)

transform (object):

x, y (number) canvas coordinates

scale_x, scale_y (number)

rotation_deg (number)

z_index (int) ordering inside the layer

anchor (string enum recommended: center, top_left, bottom_center, etc.)

wireframe (object, optional):

artifact_id (string)

mask_artifact_id (string, optional)

version (int)

render (object, optional):

artifact_id (string)

mask_artifact_id (string, optional)

version (int)

status (enum):

DRAFT

WIREFRAME_ONLY

RENDERED

LOCKED

metadata (object) freeform tags, hints, etc.

Notes:

Wireframe and render are references to artifacts. The editor should be able to display either (or both).

Keep transform always present (even if default).

3.6 relations (array)

Relation fields:

id

subject_object_id

predicate (enum)

object_object_id

strength (0..1)

notes (string)

Suggested predicate enum (start small, extend later):

FACES

LOOKING_AT

LEFT_OF

RIGHT_OF

ABOVE

BELOW

IN_FRONT_OF

BEHIND

NEAR

HOLDING

SITTING_ON

ATTACHED_TO

3.7 zones (array, optional)

Used in Phase 3 zone-based generation. Zone fields:

id, name

shape:

{ "type": "rect", "x":..., "y":..., "width":..., "height":... }

future: { "type": "polygon", "points": [[x,y], ...] }

included_object_ids (array)

guidance_prompt (string, optional)

negative_prompt (string, optional)

3.8 constraints (array, optional)

Constraints are separate from relations so you can represent “rules” that may not be directly a relation.
Fields:

id

scope:

{ "type": "SCENE" }

{ "type": "OBJECT", "object_id": "..." }

{ "type": "RELATION", "relation_id": "..." }

{ "type": "ZONE", "zone_id": "..." }

rule (enum):

HARD (must be satisfied; block generation or require user resolution)

SOFT (warn + downgrade strength)

weight (0..1)

message (string)

3.9 artifacts (array)

Artifacts represent stored files (images, masks, tiles, etc.)
Fields:

id

type (enum): IMAGE | MASK | THUMBNAIL | DEPTH | NORMAL | TILE

subtype (string, optional): e.g. WIRE, RENDER, COMPOSITE, ZONE

uri (string): artifact://... (your own scheme) or a URL

width, height (int)

format (string): png/webp/jpg

created_at (ISO string)

metadata (object): seeds, model, params, etc.

3.10 jobs (array)

Jobs are recorded to support UI progress and reproducibility.

Fields:

id

type (enum): SKETCH | OBJECT_RENDER | FINAL_COMPOSITE | ZONE_RENDER | TILE_RENDER | REFINE

status (enum): QUEUED | RUNNING | SUCCEEDED | FAILED | CANCELED

created_at, started_at, finished_at (ISO string)

input_hash (string) for caching

input (object) job payload (adapter, params, targets)

outputs (object) artifact references

error (string|null)

logs (array of strings)

4. Prompt compilation contract (MVP)

The backend should produce “compiled prompts” for each job type from:

Scene: overarching_prompt, negative_prompt, style_preset

Object: prompt, negative_prompt

Relations: convert relevant relations into short text hints (based on strength)

Zone: include zone guidance prompts if present

Minimum contract:

For SKETCH: compiled prompt should be short and object-focused.

For OBJECT_RENDER: compiled prompt includes overarching + object + relation hints.

For FINAL_COMPOSITE: compiled prompt includes overarching + global style.

Keep the compiled prompt output in job input.metadata or artifact metadata for reproducibility.

5. ID and versioning rules

IDs are strings. Prefer stable prefixes:

scene_*, layer_*, obj_*, rel_*, zone_*, job_*, art_*

Scene versioning:

Store a snapshot of SceneSpec per save point (Phase 0/MVP).

Add diffs later if needed.

When an object is regenerated:

Increment wireframe.version or render.version

Create new artifact IDs (do not overwrite files)

6. Minimal validation rules (MVP)

layer_id on objects must exist

subject_object_id and object_object_id must exist

z_index is integer; layer order is integer

artifact IDs referenced by objects/jobs should exist in artifacts (or be null if pending)

7. Recommended next step for implementation

Generate these code artifacts from this doc:

packages/shared/scenespec.ts (TS types + runtime validators)

apps/api/models/scenespec.py (Pydantic models)

A single “upsert SceneSpec” API route and a “get SceneSpec” route

Basic serializer/deserializer with schema_version migration hooks