# Development Toolchain and Practices

This document defines the baseline development workflow for AI-Image-Composer before application scaffolding begins.

## Goals

- One-command local setup.
- Consistent linting, formatting, testing, and security scanning.
- CI quality gates that match local commands.
- Clear contributor practices for predictable delivery.

## Toolchain Baseline

### JavaScript / TypeScript

- Package manager: `pnpm`
- Linting: `eslint`
- Formatting: `prettier`
- Testing: `vitest`

### Python

- Environment and dependency manager: `uv`
- Linting and formatting: `ruff`
- Testing: `pytest`
- Security and dependency scanning: `bandit`, `pip-audit`

### CI

- Platform: GitHub Actions
- Primary workflow: [ci.yml](/Users/kylescott/git/AI-Image-Composer/.github/workflows/ci.yml)
- Nightly security workflow: [nightly-security.yml](/Users/kylescott/git/AI-Image-Composer/.github/workflows/nightly-security.yml)
- Trigger:
  - `ci.yml`: all pushes and pull requests
  - `nightly-security.yml`: nightly schedule and manual dispatch

## Quick Start

Prerequisites:

- Node.js 20+
- Python 3.11+
- `pnpm` (bootstrapped via `corepack` or `npm` if missing)
- `uv` (bootstrapped via `brew`, `pipx`, or `curl` installer if missing)

Database defaults:

- Local Docker Postgres is exposed on host port `55432` by default.
- Override with `AIIC_POSTGRES_PORT` in your shell or `.env` (see `.env.example`).

Run:

```bash
make install
```

Then launch the full local stack with watchdog:

```bash
aiic
```

The default `aiic` behavior is detached/background startup. Use these operational commands:

```bash
aiic status
aiic logs manager
aiic logs api -f
aiic stop
```

If `api`, `worker`, or `web` exits repeatedly, `aiic` uses restart backoff and then marks that service as crash-loop to avoid infinite restart spam. Use `aiic status` and `aiic logs <service>` for diagnosis.

Use foreground mode only when actively debugging startup/shutdown behavior:

```bash
aiic run
```

Directed 3-layer flow (current next-break implementation pass):

1. Quick start from Projects: create project + first scene + overarching prompt.
2. Generate scene-level blocking layer from editor.
3. Add preset objects (`Person`, `Table`, `Birthday Cake`).
4. Generate wireframes (single, cycle 2-5, or N variants), choose preferred candidate.
5. Drag/place object on canvas and use `Anchor`.
6. Tune palette/lighting/harmonization controls, then run `Render All Layers + Composite` or `Render Full Scene + Refine`.

Manual mode (without `aiic`):

```bash
make setup
make hooks-install
make lint
make format-check
make test
make secrets-check
make scan
```

Run full gate locally:

```bash
make ci
```

Run scaffold services:

```bash
make db-up
make db-migrate
pnpm run dev:api
pnpm run dev:worker
pnpm run dev:web
```

`dev:worker` runs in polling mode and processes queued jobs.
Supported fake job adapters currently generate placeholder PNGs for:

- `SKETCH`
- `OBJECT_RENDER`
- `FINAL_COMPOSITE`

Export API OpenAPI schema:

```bash
make openapi
```

Artifact storage:

- Local artifacts are stored under `.artifacts/` by default.
- Override with `ARTIFACTS_ROOT=/custom/path`.
- Enable write-once/read-only files with `AIIC_ARTIFACT_IMMUTABLE_MODE=true`.

API abuse protection:

- In-memory per-client rate limiting is enabled by default.
- Configure with `AIIC_RATE_LIMIT_ENABLED`, `AIIC_RATE_LIMIT_WINDOW_SECONDS`, `AIIC_RATE_LIMIT_MAX_REQUESTS`, and `AIIC_RATE_LIMIT_EXEMPT_PATHS`.

Operational logging:

- API and worker emit structured logs with request/job context.
- Every API response includes `X-Request-ID` (propagates incoming `x-request-id` if provided).
- Configure log verbosity with `AIIC_LOG_LEVEL`.

Secrets baseline:

- `make secrets-check` validates runtime secret policy.
- In `AIIC_ENV=production|prod`, `AIIC_APP_SECRET_KEY` is required and weak placeholder values are rejected.
- Track key rotation with `AIIC_APP_SECRET_KEY_VERSION` and provider rotation bundles with `AIIC_PROVIDER_KEYSET_VERSION`.

## Self-Serve Scripts

All primary workflows are wrapped in scripts under `/scripts` and exposed via `make` and `pnpm`.

- [setup.sh](/Users/kylescott/git/AI-Image-Composer/scripts/setup.sh): install/prepare dependencies
- [install.sh](/Users/kylescott/git/AI-Image-Composer/scripts/install.sh): prerequisite checks/install + alias setup
- [aiic-watchdog.sh](/Users/kylescott/git/AI-Image-Composer/scripts/aiic-watchdog.sh): aiic manager (`start/stop/restart/status/logs/run`) with watchdog + graceful shutdown
- [lint.sh](/Users/kylescott/git/AI-Image-Composer/scripts/lint.sh): JS + Python linting
- [format.sh](/Users/kylescott/git/AI-Image-Composer/scripts/format.sh): format write/check
- [test.sh](/Users/kylescott/git/AI-Image-Composer/scripts/test.sh): JS + Python tests
- [secrets-check.sh](/Users/kylescott/git/AI-Image-Composer/scripts/secrets-check.sh): runtime secret baseline validation
- [scan.sh](/Users/kylescott/git/AI-Image-Composer/scripts/scan.sh): dependency + static security scans
- [ci.sh](/Users/kylescott/git/AI-Image-Composer/scripts/ci.sh): local CI gate
- [hooks-install.sh](/Users/kylescott/git/AI-Image-Composer/scripts/hooks-install.sh): install local git hooks
- [hooks-run.sh](/Users/kylescott/git/AI-Image-Composer/scripts/hooks-run.sh): run all hooks on demand
- [iur-smoke.sh](/Users/kylescott/git/AI-Image-Composer/scripts/iur-smoke.sh): baseline API smoke flow wrapper
- [iur-happy-path.sh](/Users/kylescott/git/AI-Image-Composer/scripts/iur-happy-path.sh): smoke + worker processing + artifact validation
- [iur-directed-3layer.sh](/Users/kylescott/git/AI-Image-Composer/scripts/iur-directed-3layer.sh): directed person/table/cake acceptance scenario
- [iur_smoke.py](/Users/kylescott/git/AI-Image-Composer/scripts/iur_smoke.py): shared smoke runner with `mvp` and `directed-3-layer` scenarios
- [db-up.sh](/Users/kylescott/git/AI-Image-Composer/scripts/db-up.sh): start local Postgres
- [db-down.sh](/Users/kylescott/git/AI-Image-Composer/scripts/db-down.sh): stop local Postgres
- [db-migrate.sh](/Users/kylescott/git/AI-Image-Composer/scripts/db-migrate.sh): apply Alembic migrations
- [db-downgrade.sh](/Users/kylescott/git/AI-Image-Composer/scripts/db-downgrade.sh): roll back one migration
- [backup-create.sh](/Users/kylescott/git/AI-Image-Composer/scripts/backup-create.sh): create timestamped DB + artifact backup bundle
- [backup-restore.sh](/Users/kylescott/git/AI-Image-Composer/scripts/backup-restore.sh): restore DB + artifacts from a backup bundle

## Makefile Commands

Reference: [Makefile](/Users/kylescott/git/AI-Image-Composer/Makefile)

- `make setup`
- `make install`
- `make aiic`
- `make aiic-start`
- `make aiic-stop`
- `make aiic-restart`
- `make aiic-status`
- `make aiic-logs`
- `make aiic-run`
- `make db-up`
- `make db-down`
- `make db-migrate`
- `make db-downgrade`
- `make backup-create`
- `make backup-restore BACKUP=/abs/path/to/aiic-backup.tar.gz`
- `make lint`
- `make format`
- `make format-check`
- `make test`
- `make secrets-check`
- `make scan`
- `make ci`
- `make hooks-install`
- `make hooks-run`
- `make iur-smoke`
- `make iur-happy-path`
- `make iur-directed-flow`
- `make iur-directed-3layer`
- `make clean`

## Git Hooks

The repository uses [`.pre-commit-config.yaml`](/Users/kylescott/git/AI-Image-Composer/.pre-commit-config.yaml) to enforce local quality gates.

- `pre-commit` hook runs: format check and lint.
- `pre-push` hook runs: full test suite.

Install hooks:

```bash
make hooks-install
```

Run hooks ad hoc:

```bash
make hooks-run
```

## Repository Governance

- CODEOWNERS is configured in [CODEOWNERS](/Users/kylescott/git/AI-Image-Composer/.github/CODEOWNERS).
- PR template is configured in [PULL_REQUEST_TEMPLATE.md](/Users/kylescott/git/AI-Image-Composer/.github/PULL_REQUEST_TEMPLATE.md).
- Issue forms are configured in:
  - [bug_report.yml](/Users/kylescott/git/AI-Image-Composer/.github/ISSUE_TEMPLATE/bug_report.yml)
  - [feature_request.yml](/Users/kylescott/git/AI-Image-Composer/.github/ISSUE_TEMPLATE/feature_request.yml)
  - [config.yml](/Users/kylescott/git/AI-Image-Composer/.github/ISSUE_TEMPLATE/config.yml)

## Dependency Automation

- Dependabot is configured in [dependabot.yml](/Users/kylescott/git/AI-Image-Composer/.github/dependabot.yml).
- It checks `npm`, `pip`, and `github-actions` dependencies weekly.

## Dev Container

- Baseline container config is in [devcontainer.json](/Users/kylescott/git/AI-Image-Composer/.devcontainer/devcontainer.json).
- The container installs Node 20 + Python 3.12 and runs `make setup` after creation.

## Foundational Development Practices

### Source control

- Open PRs for all non-trivial changes.
- Keep PRs focused and small enough to review quickly.
- Require CI to pass before merge.

### Code quality gates

- Lint must pass for JS and Python.
- Format checks must pass (no manual style drift).
- Tests should be added alongside new behavior.
- Security scan should be run before merge.

### Testing standards

- Add at least one happy-path and one failure-path test for new logic.
- Prefer fast unit tests first; add integration tests for API/worker boundaries.
- Keep deterministic tests by controlling randomness/seeds.

### Coverage thresholds rollout

Coverage thresholds are intentionally staged to avoid false gates before code scaffolding exists.

- Stage 1 (current): collect baseline tests with no enforced percentage threshold.
- Stage 2 (after `apps/api` and `apps/web` scaffolding): enforce minimum line coverage in CI for Python and JS.
- Stage 3 (post-MVP stabilization): raise thresholds and add per-package/module thresholds.

### Dependency hygiene

- Pin major versions for core tooling.
- Run `make scan` routinely and before releases.
- Upgrade dependencies in small batches to simplify rollback.

### Documentation expectations

- Update docs when behavior or commands change.
- Keep `README.md` for product overview and `DEV_README.MD` for contributor workflow.

## Remaining Manual Step

1. Configure branch protection rules in GitHub repository settings to require CI checks and reviews.
