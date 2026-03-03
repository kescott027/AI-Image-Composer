#!/usr/bin/env bash
set -euo pipefail

python3 scripts/iur_smoke.py --scenario directed-3-layer --process-jobs "$@"
