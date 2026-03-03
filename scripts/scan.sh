#!/usr/bin/env bash
set -euo pipefail

pnpm audit --audit-level=high
uv run pip-audit

python_targets=()
for target in apps packages scripts; do
  if [[ -d "$target" ]]; then
    python_targets+=("$target")
  fi
done

if [[ ${#python_targets[@]} -gt 0 ]]; then
  uv run bandit -q -r "${python_targets[@]}"
else
  echo "No Python source directories found for Bandit scan; skipping."
fi
