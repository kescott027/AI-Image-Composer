#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_ROOT="$REPO_ROOT/.run/aiic"
LOG_ROOT="$RUN_ROOT/logs"

SERVICES=("api" "worker" "web")
WATCH_INTERVAL_SECONDS=2
DB_STARTED_BY_SCRIPT=0

log() {
  echo "[aiic] $*"
}

warn() {
  echo "[aiic] WARNING: $*" >&2
}

die() {
  echo "[aiic] ERROR: $*" >&2
  exit 1
}

service_pid_file() {
  local name="$1"
  echo "$RUN_ROOT/${name}.pid"
}

service_cmd() {
  local name="$1"
  case "$name" in
    api) echo "pnpm run dev:api" ;;
    worker) echo "pnpm run dev:worker" ;;
    web) echo "pnpm run dev:web" ;;
    *) return 1 ;;
  esac
}

is_running() {
  local name="$1"
  local pid_file
  pid_file="$(service_pid_file "$name")"
  [[ -f "$pid_file" ]] || return 1

  local pid
  pid="$(cat "$pid_file")"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

start_service() {
  local name="$1"
  local command
  command="$(service_cmd "$name")"

  log "Starting $name ..."
  bash -lc "cd \"$REPO_ROOT\" && $command" >"$LOG_ROOT/${name}.log" 2>&1 &
  local pid=$!
  echo "$pid" >"$(service_pid_file "$name")"
  log "$name started (pid=$pid, log=$LOG_ROOT/${name}.log)"
}

stop_service() {
  local name="$1"
  local pid_file
  pid_file="$(service_pid_file "$name")"
  [[ -f "$pid_file" ]] || return 0

  local pid
  pid="$(cat "$pid_file")"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    log "Stopping $name (pid=$pid) ..."
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
  rm -f "$pid_file"
}

ensure_prerequisites() {
  for cmd in pnpm uv docker; do
    command -v "$cmd" >/dev/null 2>&1 || die "Missing required command '$cmd'. Run: make install"
  done
  docker compose version >/dev/null 2>&1 || die "Docker Compose plugin missing. Run: make install"
}

start_database_if_needed() {
  if (cd "$REPO_ROOT" && docker compose ps --status running postgres 2>/dev/null | grep -q postgres); then
    DB_STARTED_BY_SCRIPT=0
    log "Postgres already running."
  else
    DB_STARTED_BY_SCRIPT=1
    log "Starting Postgres ..."
    (cd "$REPO_ROOT" && ./scripts/db-up.sh)
  fi

  log "Applying migrations ..."
  (cd "$REPO_ROOT" && ./scripts/db-migrate.sh)
}

cleanup() {
  trap - EXIT INT TERM
  log "Shutting down aiic services ..."

  # Stop app processes first.
  stop_service web
  stop_service worker
  stop_service api

  if [[ "$DB_STARTED_BY_SCRIPT" -eq 1 ]]; then
    log "Stopping Postgres started by aiic ..."
    (cd "$REPO_ROOT" && ./scripts/db-down.sh) || warn "Failed to stop Postgres cleanly."
  fi

  log "Shutdown complete."
}

main() {
  ensure_prerequisites

  mkdir -p "$LOG_ROOT"
  start_database_if_needed

  trap cleanup EXIT INT TERM

  for service in "${SERVICES[@]}"; do
    start_service "$service"
  done

  log "AI Image Composer running."
  log "Web: http://localhost:5173"
  log "API: http://localhost:8000/health"
  log "Press Ctrl+C to stop all services."

  while true; do
    for service in "${SERVICES[@]}"; do
      if ! is_running "$service"; then
        warn "$service exited. Restarting ..."
        start_service "$service"
      fi
    done
    sleep "$WATCH_INTERVAL_SECONDS"
  done
}

main "$@"
