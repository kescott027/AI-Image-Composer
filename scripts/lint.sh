#!/usr/bin/env bash
set -euo pipefail

pnpm run lint:js
uv run ruff check .
