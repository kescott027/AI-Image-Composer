#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AIIC_LAUNCHER="$REPO_ROOT/scripts/aiic-watchdog.sh"

BLOCK_START="# >>> aiic launcher >>>"
BLOCK_END="# <<< aiic launcher <<<"
APT_UPDATED=0

log() {
  echo "[install] $*"
}

warn() {
  echo "[install] WARNING: $*" >&2
}

die() {
  echo "[install] ERROR: $*" >&2
  exit 1
}

platform() {
  case "$(uname -s)" in
    Darwin) echo "darwin" ;;
    Linux) echo "linux" ;;
    *) echo "unknown" ;;
  esac
}

run_as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
    return 0
  fi
  if command -v sudo >/dev/null 2>&1; then
    sudo "$@"
    return 0
  fi
  return 1
}

install_with_brew() {
  local package="$1"
  if ! command -v brew >/dev/null 2>&1; then
    die "Homebrew is required to auto-install '$package' on macOS."
  fi
  brew install "$package"
}

install_with_brew_cask() {
  local package="$1"
  if ! command -v brew >/dev/null 2>&1; then
    die "Homebrew is required to auto-install '$package' on macOS."
  fi
  brew install --cask "$package"
}

apt_update_once() {
  if [[ "$APT_UPDATED" -eq 1 ]]; then
    return 0
  fi
  if ! run_as_root apt-get update; then
    die "Cannot run apt-get update. Re-run with a user that has sudo access."
  fi
  APT_UPDATED=1
}

install_with_apt() {
  local package="$1"
  apt_update_once
  if ! run_as_root apt-get install -y "$package"; then
    die "Failed to install package '$package' via apt."
  fi
}

ensure_command() {
  local command_name="$1"
  local description="$2"
  local mac_package="${3:-}"
  local linux_package="${4:-}"

  if command -v "$command_name" >/dev/null 2>&1; then
    log "$description already installed ($command_name)."
    return 0
  fi

  log "$description not found. Attempting installation..."
  case "$(platform)" in
    darwin)
      [[ -n "$mac_package" ]] || die "No macOS package configured for '$description'."
      install_with_brew "$mac_package"
      ;;
    linux)
      [[ -n "$linux_package" ]] || die "No Linux package configured for '$description'."
      install_with_apt "$linux_package"
      ;;
    *)
      die "Unsupported OS. Install '$description' manually, then rerun make install."
      ;;
  esac

  command -v "$command_name" >/dev/null 2>&1 || die "Installation finished but '$command_name' is still unavailable."
  log "$description installed."
}

ensure_docker() {
  if command -v docker >/dev/null 2>&1; then
    log "Docker CLI already installed."
    return 0
  fi

  log "Docker CLI not found. Attempting installation..."
  case "$(platform)" in
    darwin) install_with_brew_cask docker ;;
    linux) install_with_apt docker.io ;;
    *) die "Unsupported OS. Install Docker manually." ;;
  esac

  command -v docker >/dev/null 2>&1 || die "Docker install did not provide 'docker' command."
  log "Docker installed."
}

ensure_docker_compose() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker Compose plugin already installed."
    return 0
  fi

  log "Docker Compose plugin not found. Attempting installation..."
  case "$(platform)" in
    darwin)
      # Docker Desktop ships compose plugin.
      install_with_brew_cask docker
      ;;
    linux)
      install_with_apt docker-compose-plugin
      ;;
    *)
      die "Unsupported OS. Install Docker Compose manually."
      ;;
  esac

  if ! docker compose version >/dev/null 2>&1; then
    warn "Docker Compose plugin not detected yet. You may need to restart Docker."
  else
    log "Docker Compose plugin installed."
  fi
}

strip_existing_aiic_block() {
  local file="$1"
  local tmp_file
  tmp_file="$(mktemp)"
  awk -v start="$BLOCK_START" -v end="$BLOCK_END" '
    $0 == start { skip = 1; next }
    $0 == end { skip = 0; next }
    !skip { print }
  ' "$file" >"$tmp_file"
  mv "$tmp_file" "$file"
}

install_aiic_alias() {
  local file="$1"
  mkdir -p "$(dirname "$file")"
  [[ -f "$file" ]] || touch "$file"

  strip_existing_aiic_block "$file"

  {
    echo
    echo "$BLOCK_START"
    echo "aiic() {"
    printf '  bash "%s" "$@"\n' "$AIIC_LAUNCHER"
    echo "}"
    echo "$BLOCK_END"
  } >>"$file"

  log "Installed aiic launcher function in $file"
}

main() {
  ensure_command git "Git" git git
  ensure_command curl "curl" curl curl
  ensure_command make "make" make make
  ensure_command python3 "Python 3" python@3.12 python3
  ensure_command node "Node.js" node nodejs
  ensure_docker
  ensure_docker_compose

  chmod +x "$AIIC_LAUNCHER"

  log "Running project dependency setup..."
  "$REPO_ROOT/scripts/setup.sh"

  if command -v zsh >/dev/null 2>&1; then
    install_aiic_alias "$HOME/.zshrc"
  fi
  if command -v bash >/dev/null 2>&1; then
    install_aiic_alias "$HOME/.bashrc"
  fi

  log "Install complete."
  log "Open a new shell (or source your rc file), then run: aiic"
  log "If Docker Desktop was just installed, launch it once before running aiic."
}

main "$@"
