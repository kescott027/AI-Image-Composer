#!/usr/bin/env bash
set -euo pipefail

./scripts/lint.sh
./scripts/format.sh check
./scripts/test.sh
./scripts/scan.sh
