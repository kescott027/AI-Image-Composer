#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_ROOT="$REPO_ROOT/.run/aiic"
LOG_ROOT="$RUN_ROOT/logs"
MANAGER_PID_FILE="$RUN_ROOT/manager.pid"
MANAGER_LOG_FILE="$LOG_ROOT/manager.log"
DB_OWNER_FLAG_FILE="$RUN_ROOT/db.started_by_aiic"
READY_FILE="$RUN_ROOT/ready"
WEB_URL="http://localhost:5173"
API_URL="http://localhost:8000/health"

SERVICES=("api" "worker" "web")
WATCH_INTERVAL_SECONDS="${AIIC_WATCH_INTERVAL_SECONDS:-2}"
DB_STARTED_BY_SCRIPT=0

cli_log() {
  echo "[aiic] $*"
}

cli_warn() {
  echo "[aiic] WARNING: $*" >&2
}

die() {
  echo "[aiic] ERROR: $*" >&2
  exit 1
}

manager_log() {
  mkdir -p "$LOG_ROOT"
  printf '%s [aiic] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$MANAGER_LOG_FILE"
}

ensure_runtime_dirs() {
  mkdir -p "$RUN_ROOT" "$LOG_ROOT"
}

read_pid_file() {
  local file="$1"
  [[ -f "$file" ]] || return 1
  local pid
  pid="$(cat "$file" 2>/dev/null || true)"
  [[ -n "$pid" ]] || return 1
  echo "$pid"
}

pid_running() {
  local pid="$1"
  kill -0 "$pid" 2>/dev/null
}

manager_pid() {
  read_pid_file "$MANAGER_PID_FILE" || true
}

manager_running() {
  local pid
  pid="$(manager_pid)"
  [[ -n "$pid" ]] || return 1
  pid_running "$pid"
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
  local pid
  pid="$(read_pid_file "$(service_pid_file "$name")" || true)"
  [[ -n "$pid" ]] || return 1
  pid_running "$pid"
}

start_service() {
  local name="$1"
  local command
  command="$(service_cmd "$name")"

  if is_running "$name"; then
    manager_log "$name already running (pid=$(read_pid_file "$(service_pid_file "$name")"))."
    return 0
  fi

  manager_log "Starting $name ..."
  bash -lc "cd \"$REPO_ROOT\" && $command" >"$LOG_ROOT/${name}.log" 2>&1 &
  local pid=$!
  echo "$pid" >"$(service_pid_file "$name")"
  manager_log "$name started (pid=$pid, log=$LOG_ROOT/${name}.log)"
}

stop_service() {
  local name="$1"
  local pid_file pid
  pid_file="$(service_pid_file "$name")"
  pid="$(read_pid_file "$pid_file" || true)"
  [[ -n "$pid" ]] || {
    rm -f "$pid_file"
    return 0
  }

  if pid_running "$pid"; then
    manager_log "Stopping $name (pid=$pid) ..."
    kill "$pid" 2>/dev/null || true
    for _ in {1..20}; do
      pid_running "$pid" || break
      sleep 0.25
    done
    if pid_running "$pid"; then
      manager_log "$name (pid=$pid) did not stop gracefully, sending SIGKILL."
      kill -9 "$pid" 2>/dev/null || true
    fi
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
    if [[ -f "$DB_OWNER_FLAG_FILE" ]]; then
      DB_STARTED_BY_SCRIPT=1
      manager_log "Postgres already running (owned by aiic)."
    else
      DB_STARTED_BY_SCRIPT=0
      manager_log "Postgres already running."
    fi
  else
    DB_STARTED_BY_SCRIPT=1
    manager_log "Starting Postgres ..."
    touch "$DB_OWNER_FLAG_FILE"
    (cd "$REPO_ROOT" && ./scripts/db-up.sh)
  fi

  manager_log "Waiting for Postgres readiness ..."
  (cd "$REPO_ROOT" && ./scripts/db-wait.sh)

  manager_log "Applying migrations ..."
  (cd "$REPO_ROOT" && ./scripts/db-migrate.sh)
}

cleanup() {
  trap - EXIT INT TERM
  manager_log "Shutting down aiic services ..."

  # Stop app processes first.
  stop_service web
  stop_service worker
  stop_service api

  if [[ "$DB_STARTED_BY_SCRIPT" -eq 1 ]]; then
    manager_log "Stopping Postgres started by aiic ..."
    (cd "$REPO_ROOT" && ./scripts/db-down.sh) || manager_log "WARNING: Failed to stop Postgres cleanly."
    rm -f "$DB_OWNER_FLAG_FILE"
  fi

  rm -f "$READY_FILE"
  rm -f "$MANAGER_PID_FILE"
  manager_log "Shutdown complete."
}

watchdog_loop() {
  while true; do
    for service in "${SERVICES[@]}"; do
      if ! is_running "$service"; then
        manager_log "WARNING: $service exited. Restarting ..."
        start_service "$service"
      fi
    done
    sleep "$WATCH_INTERVAL_SECONDS"
  done
}

run_foreground() {
  ensure_prerequisites
  ensure_runtime_dirs

  if manager_running; then
    die "aiic is already running (pid=$(manager_pid)). Use: aiic stop"
  fi

  echo "$$" >"$MANAGER_PID_FILE"
  manager_log "Starting aiic in foreground mode."
  start_database_if_needed

  trap cleanup EXIT INT TERM

  for service in "${SERVICES[@]}"; do
    start_service "$service"
  done

  touch "$READY_FILE"
  cli_log "AI Image Composer running (foreground mode)."
  cli_log "Web: $WEB_URL"
  cli_log "API: $API_URL"
  cli_log "Press Ctrl+C to stop all services."
  cli_log "Logs: $LOG_ROOT"

  watchdog_loop
}

run_daemon() {
  ensure_prerequisites
  ensure_runtime_dirs

  if manager_running; then
    die "aiic is already running (pid=$(manager_pid))"
  fi

  echo "$$" >"$MANAGER_PID_FILE"
  manager_log "Starting aiic daemon."

  trap cleanup EXIT INT TERM

  start_database_if_needed

  for service in "${SERVICES[@]}"; do
    start_service "$service"
  done

  touch "$READY_FILE"
  manager_log "AI Image Composer running. Web=$WEB_URL API=$API_URL"
  watchdog_loop
}

open_browser_window() {
  local url="$WEB_URL"
  case "$(uname -s)" in
    Darwin)
      command -v open >/dev/null 2>&1 && open "$url" >/dev/null 2>&1 || true
      ;;
    Linux)
      command -v xdg-open >/dev/null 2>&1 && xdg-open "$url" >/dev/null 2>&1 || true
      ;;
    *)
      :
      ;;
  esac
}

start_daemon() {
  local should_open_browser="${1:-1}"
  ensure_runtime_dirs
  if manager_running; then
    cli_log "AI Image Composer already running (pid=$(manager_pid))."
    if [[ "$should_open_browser" -eq 1 ]]; then
      open_browser_window
    fi
    return 0
  fi

  nohup bash "$0" __daemon >>"$MANAGER_LOG_FILE" 2>&1 &
  local daemon_pid=$!

  for _ in {1..80}; do
    if manager_running && [[ -f "$READY_FILE" ]]; then
      cli_log "AI Image Composer started in background."
      cli_log "Manager PID: $(manager_pid)"
      cli_log "Web: $WEB_URL"
      cli_log "API: $API_URL"
      cli_log "Logs: $LOG_ROOT"
      if [[ "$should_open_browser" -eq 1 ]]; then
        open_browser_window
      fi
      return 0
    fi
    if ! pid_running "$daemon_pid"; then
      break
    fi
    sleep 0.25
  done

  cli_warn "aiic did not report healthy startup. Check logs:"
  cli_warn "  $MANAGER_LOG_FILE"
  return 1
}

stop_daemon() {
  ensure_runtime_dirs

  local pid
  pid="$(manager_pid)"
  if [[ -n "$pid" ]] && pid_running "$pid"; then
    cli_log "Stopping aiic manager (pid=$pid) ..."
    kill "$pid" 2>/dev/null || true
    for _ in {1..40}; do
      pid_running "$pid" || break
      sleep 0.25
    done
    if pid_running "$pid"; then
      cli_warn "Manager did not stop gracefully. Sending SIGKILL."
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi

  # Ensure services are down, even if manager was not running.
  for service in web worker api; do
    stop_service "$service"
  done

  if [[ -f "$DB_OWNER_FLAG_FILE" ]]; then
    cli_log "Stopping Postgres started by aiic ..."
    (cd "$REPO_ROOT" && ./scripts/db-down.sh) || cli_warn "Failed to stop Postgres cleanly."
    rm -f "$DB_OWNER_FLAG_FILE"
  fi

  rm -f "$READY_FILE"
  rm -f "$MANAGER_PID_FILE"
  cli_log "AI Image Composer stopped."
}

status_daemon() {
  local overall="stopped"
  if manager_running; then
    overall="running"
    cli_log "Manager: running (pid=$(manager_pid))"
  else
    cli_log "Manager: stopped"
  fi

  for service in "${SERVICES[@]}"; do
    if is_running "$service"; then
      cli_log "Service $service: running (pid=$(read_pid_file "$(service_pid_file "$service")"))"
      overall="running"
    else
      cli_log "Service $service: stopped"
    fi
  done

  if (cd "$REPO_ROOT" && docker compose ps --status running postgres 2>/dev/null | grep -q postgres); then
    if [[ -f "$DB_OWNER_FLAG_FILE" ]]; then
      cli_log "Database: running (owned by aiic)"
    else
      cli_log "Database: running (external)"
    fi
    overall="running"
  else
    cli_log "Database: stopped"
  fi

  cli_log "Logs: $LOG_ROOT"
  [[ "$overall" == "running" ]] && return 0
  return 1
}

logs_daemon() {
  local target="${1:-manager}"
  local follow="${2:-0}"
  local file

  case "$target" in
    manager | api | worker | web)
      file="$LOG_ROOT/${target}.log"
      ;;
    *)
      die "Unknown log target '$target'. Use: manager|api|worker|web"
      ;;
  esac

  [[ -f "$file" ]] || die "Log file not found: $file"

  if [[ "$follow" -eq 1 ]]; then
    tail -n 120 -f "$file"
  else
    tail -n 120 "$file"
  fi
}

usage() {
  cat <<'EOF'
Usage: aiic [command]

Commands:
  start           Start aiic in background (default)
  start --no-open Start without opening browser
  stop            Stop manager and all aiic-owned services
  restart         Restart manager/services
  status          Show manager/service/database status
  logs [target]   Show logs (target: manager|api|worker|web, default manager)
  logs [target] -f  Follow logs
  run             Run in foreground (Ctrl+C to stop)
  help            Show this help
EOF
}

main() {
  local cmd="${1:-start}"
  shift || true

  case "$cmd" in
    __daemon)
      run_daemon
      ;;
    start)
      local should_open_browser=1
      if [[ "${1:-}" == "--no-open" ]]; then
        should_open_browser=0
      fi
      start_daemon "$should_open_browser"
      ;;
    stop | down | exit)
      stop_daemon
      ;;
    restart)
      stop_daemon
      start_daemon 1
      ;;
    status)
      status_daemon
      ;;
    logs)
      local target="${1:-manager}"
      local follow=0
      if [[ "${2:-}" == "-f" || "${2:-}" == "--follow" || "${1:-}" == "-f" || "${1:-}" == "--follow" ]]; then
        follow=1
        if [[ "$target" == "-f" || "$target" == "--follow" ]]; then
          target="manager"
        fi
      fi
      logs_daemon "$target" "$follow"
      ;;
    run)
      run_foreground
      ;;
    help | -h | --help)
      usage
      ;;
    *)
      die "Unknown command '$cmd'. Use: aiic help"
      ;;
  esac
}

main "$@"
