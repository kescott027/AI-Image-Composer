#!/usr/bin/env bash
set -euo pipefail

output_path="${1:-apps/api/openapi.json}"

uv run python - <<PY
import json
from apps.api.main import app

with open("${output_path}", "w", encoding="utf-8") as f:
    json.dump(app.openapi(), f, indent=2)
print(f"OpenAPI exported to ${output_path}")
PY
