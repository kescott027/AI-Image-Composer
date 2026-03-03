# AI-Image-Composer

AI Multi-Layer Image Composer

A structured, scene-graph driven image generation system that moves beyond simple text-to-image prompting. This project enables users to construct images through layered composition, object relationships, wireframe blocking, and staged ML generation.

The core idea is simple: instead of generating a full image from a single prompt, we build a structured scene specification (SceneSpec) and progressively generate wireframes, objects, and composites using controlled relationships and layout logic.

Vision

Traditional text-to-image tools generate monolithic results. This project introduces:

A layered canvas editor

A structured scene graph (SceneSpec)

Object-level generation

Relation-aware prompt compilation

Zone-based compositing (Phase 3)

Deterministic and versioned outputs

The system is designed for precision, iteration, and extensibility.

High-Level Architecture

The system is composed of four major layers:

1. Frontend (React + TypeScript)

Responsibilities:

Canvas editor

Scene graph UI

Layer management

Object transforms

Prompt editing

Job monitoring

The frontend maintains a canonical SceneSpec state and communicates with the API for persistence and generation jobs.

2. API Layer (FastAPI)

Responsibilities:

SceneSpec CRUD

Project management

Job submission and status tracking

Artifact registration and retrieval

Prompt compilation

The API serves as the orchestration layer between the UI and ML workers.

3. Worker Layer

Responsibilities:

Process generation jobs

Execute model adapters

Store output artifacts

Update job status

Workers can run locally or on dedicated GPU machines.

4. ML Adapter Layer

Model adapters implement a consistent interface for:

Sketch generation

Object rendering

Composite rendering

Zone rendering (Phase 3)

Refinement passes

Adapters are swappable without changing the core system.
See `docs/MODEL_ADAPTER_SETUP.MD` for real-model adapter configuration.

Repository Structure
/apps
/web React frontend
/api FastAPI backend
/worker Job runner

/packages
/shared Shared types and SceneSpec definitions
Core Concept: SceneSpec

The SceneSpec is the canonical representation of a scene.

It contains:

Overarching prompt

Layers

Objects

Relations

Zones (Phase 3)

Artifacts

Jobs

Generation settings

All editor operations modify the SceneSpec.
All ML jobs consume a snapshot of the SceneSpec.
All results are tied back to artifact IDs for reproducibility.

See `docs/SCENE_SPEC.MD` for full schema documentation.

Development Phases
Phase 0 – Foundations

Monorepo setup

SceneSpec schema

Database schema

CRUD endpoints

Job scaffolding

Fake generator for pipeline testing

MVP – Initial Usable Release

Canvas editor

Layer and object management

Wireframe generation

Object rendering

Simple alpha composite

Scene versioning

Relation-aware prompt compilation

Phase 2 – Constraint Intelligence

Relation conflict detection

Constraint engine

Real ML adapter integration

Phase 3 – Zone-Based Generation

Manual and automatic zones

Per-zone generation

Seam stitching

Optional global refinement pass

Local Development
Prerequisites

Node 20+

Python 3.11+

Docker (for Postgres)

Optional GPU for ML adapters

1. Install dependencies and hooks
   make setup
2. Start local Postgres
   make db-up
3. Apply DB migrations
   make db-migrate
4. Start API
   pnpm run dev:api
5. Start Worker
   pnpm run dev:worker
6. Start Frontend
   pnpm run dev:web

IUR smoke validation:

make iur-smoke

Generation Flow

User edits SceneSpec in UI.

UI submits generation job to API.

API records job and queues it.

Worker processes job via adapter.

Worker stores artifact and updates job status.

UI receives update and renders artifact.

Job Types

SKETCH

OBJECT_RENDER

FINAL_COMPOSITE

ZONE_RENDER

REFINE

Each job references:

Scene version

Target object or zone

Adapter name

Generation parameters

Design Principles

Scene-first, not prompt-first

Deterministic and versionable

Swappable ML backends

Separation of UI logic and generation logic

Clear data ownership via SceneSpec

Reproducibility over magic

Why This Matters

This system enables:

Structured art direction

Controlled composition

Object-level iteration

Relation-aware generation

Scalable ML orchestration

It is designed as a platform, not just a tool.

Future Extensions

Depth and normal map generation

Lighting-aware compositing

Plugin model ecosystem

Multi-user collaboration

Asset library

Scene branching and diff views

Status

Under active development. See milestone tracking in project issues.

License

TBD
