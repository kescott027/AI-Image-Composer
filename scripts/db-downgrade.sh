#!/usr/bin/env bash
set -euo pipefail

uv run alembic -c apps/api/alembic.ini downgrade -1
