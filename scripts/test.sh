#!/usr/bin/env bash
set -euo pipefail

pnpm run test:js
uv run pytest
