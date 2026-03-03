#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_ROOT="${AIIC_BACKUP_ROOT:-$REPO_ROOT/.backups}"
ARTIFACTS_ROOT="${ARTIFACTS_ROOT:-$REPO_ROOT/.artifacts}"
DB_CONTAINER_PATH="/tmp/aiic-backup.dump"
DB_NAME="${AIIC_BACKUP_DB_NAME:-ai_image_composer}"
DB_USER="${AIIC_BACKUP_DB_USER:-postgres}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[backup] ERROR: docker is required." >&2
  exit 1
fi

if ! docker compose ps --status running postgres >/dev/null 2>&1; then
  echo "[backup] ERROR: Postgres service is not running. Start it with: make db-up" >&2
  exit 1
fi

mkdir -p "$BACKUP_ROOT"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

echo "[backup] Creating database dump ..."
docker compose exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc >"$tmp_dir/db.dump"

if [[ -d "$ARTIFACTS_ROOT" ]]; then
  echo "[backup] Copying artifacts from $ARTIFACTS_ROOT ..."
  mkdir -p "$tmp_dir/artifacts"
  cp -R "$ARTIFACTS_ROOT/." "$tmp_dir/artifacts/"
else
  echo "[backup] Artifacts directory not found at $ARTIFACTS_ROOT; skipping artifact copy."
fi

cat >"$tmp_dir/manifest.txt" <<EOF
timestamp=$timestamp
db_name=$DB_NAME
db_user=$DB_USER
artifact_root=$ARTIFACTS_ROOT
git_rev=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)
EOF

backup_file="$BACKUP_ROOT/aiic-backup-$timestamp.tar.gz"
tar -C "$tmp_dir" -czf "$backup_file" .
echo "[backup] Created $backup_file"
