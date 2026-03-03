#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ARTIFACTS_ROOT="${ARTIFACTS_ROOT:-$REPO_ROOT/.artifacts}"
DB_NAME="${AIIC_BACKUP_DB_NAME:-ai_image_composer}"
DB_USER="${AIIC_BACKUP_DB_USER:-postgres}"

backup_file="${1:-}"
if [[ -z "$backup_file" ]]; then
  echo "[restore] ERROR: backup file path required." >&2
  echo "[restore] Usage: ./scripts/backup-restore.sh /path/to/aiic-backup-*.tar.gz" >&2
  exit 1
fi
if [[ ! -f "$backup_file" ]]; then
  echo "[restore] ERROR: backup file not found: $backup_file" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[restore] ERROR: docker is required." >&2
  exit 1
fi

if ! docker compose ps --status running postgres >/dev/null 2>&1; then
  echo "[restore] ERROR: Postgres service is not running. Start it with: make db-up" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
tar -C "$tmp_dir" -xzf "$backup_file"

if [[ ! -f "$tmp_dir/db.dump" ]]; then
  echo "[restore] ERROR: backup archive missing db.dump" >&2
  exit 1
fi

echo "[restore] Restoring database $DB_NAME ..."
cat "$tmp_dir/db.dump" | docker compose exec -T postgres \
  pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --no-privileges

if [[ -d "$tmp_dir/artifacts" ]]; then
  echo "[restore] Restoring artifacts into $ARTIFACTS_ROOT ..."
  rm -rf "$ARTIFACTS_ROOT"
  mkdir -p "$ARTIFACTS_ROOT"
  cp -R "$tmp_dir/artifacts/." "$ARTIFACTS_ROOT/"
else
  echo "[restore] No artifacts directory in backup archive; skipping artifact restore."
fi

echo "[restore] Restore complete from $backup_file"
