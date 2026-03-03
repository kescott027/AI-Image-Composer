#!/usr/bin/env bash
set -euo pipefail

ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    return 0
  fi

  if command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack prepare pnpm@10.7.0 --activate
    return 0
  fi

  if command -v npm >/dev/null 2>&1; then
    if npm install -g pnpm@10.7.0; then
      return 0
    fi

    npm install --global --prefix "$HOME/.local" pnpm@10.7.0
    export PATH="$HOME/.local/bin:$PATH"
    if command -v pnpm >/dev/null 2>&1; then
      return 0
    fi
  fi

  echo "pnpm is required but was not found. Install pnpm (https://pnpm.io/installation)." >&2
  exit 1
}

ensure_uv() {
  if command -v uv >/dev/null 2>&1; then
    return 0
  fi

  if command -v brew >/dev/null 2>&1; then
    if brew install uv; then
      return 0
    fi
  fi

  if command -v pipx >/dev/null 2>&1; then
    if pipx install uv >/dev/null 2>&1 || pipx upgrade uv >/dev/null 2>&1; then
      return 0
    fi
  fi

  if command -v curl >/dev/null 2>&1; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
    if command -v uv >/dev/null 2>&1; then
      return 0
    fi
  fi

  echo "uv is required but was not found. Install uv (https://docs.astral.sh/uv/getting-started/installation/)." >&2
  exit 1
}

ensure_pnpm
ensure_uv

pnpm install
uv sync --group dev
