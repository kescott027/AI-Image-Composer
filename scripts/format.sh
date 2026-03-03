#!/usr/bin/env bash
set -euo pipefail

mode="${1:-check}"

if [[ "$mode" == "write" ]]; then
  pnpm run format:js
  uv run ruff format .
  exit 0
fi

pnpm run format:js:check
uv run ruff format --check .
