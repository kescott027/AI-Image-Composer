#!/usr/bin/env bash
set -euo pipefail

MAX_ATTEMPTS="${AIIC_DB_WAIT_ATTEMPTS:-30}"
SLEEP_SECONDS="${AIIC_DB_WAIT_INTERVAL_SECONDS:-2}"

log() {
  echo "[db-wait] $*"
}

die() {
  echo "[db-wait] ERROR: $*" >&2
  exit 1
}

print_postgres_logs() {
  docker compose logs --tail 120 postgres || true
}

main() {
  local container_id
  container_id="$(docker compose ps -q postgres)"

  if [[ -z "$container_id" ]]; then
    die "Postgres container not found. Run: make db-up"
  fi

  local attempt=1
  while [[ "$attempt" -le "$MAX_ATTEMPTS" ]]; do
    local status
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"

    case "$status" in
      healthy)
        log "Postgres is healthy."
        return 0
        ;;
      unhealthy | exited | dead)
        print_postgres_logs
        die "Postgres container is '$status'."
        ;;
      running)
        # For images without healthcheck; ours has one, but keep fallback.
        log "Postgres is running (no health status). Continuing."
        return 0
        ;;
      *)
        # starting / created / restarting / empty
        ;;
    esac

    sleep "$SLEEP_SECONDS"
    attempt=$((attempt + 1))
  done

  print_postgres_logs
  die "Postgres did not become healthy after ${MAX_ATTEMPTS} attempts."
}

main "$@"
