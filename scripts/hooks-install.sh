#!/usr/bin/env bash
set -euo pipefail

uv run pre-commit install --hook-type pre-commit --hook-type pre-push
uv run pre-commit install-hooks
