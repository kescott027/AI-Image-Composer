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

Run:

```bash
make setup
make hooks-install
make lint
make format-check
make test
make scan
```

Run full gate locally:

```bash
make ci
```

## Self-Serve Scripts

All primary workflows are wrapped in scripts under `/scripts` and exposed via `make` and `pnpm`.

- [setup.sh](/Users/kylescott/git/AI-Image-Composer/scripts/setup.sh): install/prepare dependencies
- [lint.sh](/Users/kylescott/git/AI-Image-Composer/scripts/lint.sh): JS + Python linting
- [format.sh](/Users/kylescott/git/AI-Image-Composer/scripts/format.sh): format write/check
- [test.sh](/Users/kylescott/git/AI-Image-Composer/scripts/test.sh): JS + Python tests
- [scan.sh](/Users/kylescott/git/AI-Image-Composer/scripts/scan.sh): dependency + static security scans
- [ci.sh](/Users/kylescott/git/AI-Image-Composer/scripts/ci.sh): local CI gate
- [hooks-install.sh](/Users/kylescott/git/AI-Image-Composer/scripts/hooks-install.sh): install local git hooks
- [hooks-run.sh](/Users/kylescott/git/AI-Image-Composer/scripts/hooks-run.sh): run all hooks on demand

## Makefile Commands

Reference: [Makefile](/Users/kylescott/git/AI-Image-Composer/Makefile)

- `make setup`
- `make lint`
- `make format`
- `make format-check`
- `make test`
- `make scan`
- `make ci`
- `make hooks-install`
- `make hooks-run`
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

## Remaining Recommendation

1. Add CODEOWNERS for API/Web/Worker ownership as team grows.
