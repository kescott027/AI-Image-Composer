SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

.PHONY: help install setup db-up db-down db-migrate db-downgrade dev-api dev-worker worker-job-once dev-web aiic openapi lint format format-check test scan ci hooks-install hooks-run iur-smoke iur-happy-path clean

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "%-16s %s\n", $$1, $$2}'

install: ## Install prerequisites/dependencies and configure aiic launcher alias
	./scripts/install.sh

setup: ## Install toolchains and project dependencies
	./scripts/setup.sh

db-up: ## Start local Postgres service via docker compose
	./scripts/db-up.sh

db-down: ## Stop local Postgres service via docker compose
	./scripts/db-down.sh

db-migrate: ## Apply Alembic migrations to the configured database
	./scripts/db-migrate.sh

db-downgrade: ## Roll back one Alembic migration revision
	./scripts/db-downgrade.sh

dev-api: ## Run FastAPI development server
	pnpm run dev:api

dev-worker: ## Run worker in polling mode to process queued jobs
	pnpm run dev:worker

worker-job-once: ## Process a single queued job immediately
	pnpm run worker:run-job-once

dev-web: ## Run web development server
	pnpm run dev:web

aiic: ## Launch API + worker + web with watchdog and graceful shutdown
	./scripts/aiic-watchdog.sh

openapi: ## Export FastAPI OpenAPI schema to apps/api/openapi.json
	./scripts/export-openapi.sh

lint: ## Run JS + Python linting
	./scripts/lint.sh

format: ## Auto-format JS + Python code
	./scripts/format.sh write

format-check: ## Verify formatting without changing files
	./scripts/format.sh check

test: ## Run all tests
	./scripts/test.sh

scan: ## Run dependency + static security scans
	./scripts/scan.sh

ci: ## Run the full local CI gate
	./scripts/ci.sh

hooks-install: ## Install git pre-commit and pre-push hooks
	./scripts/hooks-install.sh

hooks-run: ## Run all pre-commit hooks against all files
	./scripts/hooks-run.sh

iur-smoke: ## Execute the Initial Usable Release API smoke workflow
	./scripts/iur-smoke.sh

iur-happy-path: ## Execute IUR smoke + process jobs + validate composite artifact
	./scripts/iur-happy-path.sh

clean: ## Remove common local caches/artifacts
	rm -rf .venv .pytest_cache .ruff_cache .pre-commit-cache .coverage coverage dist node_modules
