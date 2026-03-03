#!/usr/bin/env bash
set -euo pipefail

pnpm run test:js
uv run pytest
uv run python apps/worker/worker.py --once
