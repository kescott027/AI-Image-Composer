#!/usr/bin/env bash
set -euo pipefail

uv run python - <<'PY'
from apps.api.security.secrets import assert_runtime_secrets, runtime_secret_metadata

assert_runtime_secrets()
meta = runtime_secret_metadata()
print(
    "[secrets-check] ok "
    f"env={meta['env']} "
    f"app_secret_key_version={meta['app_secret_key_version']} "
    f"provider_keyset_version={meta['provider_keyset_version']}"
)
PY

