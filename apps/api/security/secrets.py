from __future__ import annotations

import os
from dataclasses import dataclass

_PRODUCTION_ENV_VALUES = {"production", "prod"}
_REQUIRED_PRODUCTION_SECRETS = ("AIIC_APP_SECRET_KEY",)
_WEAK_SECRET_MARKERS = ("changeme", "replace", "example", "dummy", "test", "password")


@dataclass(frozen=True)
class SecretCheckResult:
    missing: list[str]
    weak: list[str]

    @property
    def ok(self) -> bool:
        return not self.missing and not self.weak


def _normalized(value: str | None) -> str:
    if value is None:
        return ""
    return value.strip()


def _is_weak_secret(value: str) -> bool:
    candidate = value.lower()
    if len(value) < 16:
        return True
    return any(marker in candidate for marker in _WEAK_SECRET_MARKERS)


def _runtime_env() -> str:
    return _normalized(os.getenv("AIIC_ENV", "development")).lower()


def validate_production_secrets() -> SecretCheckResult:
    missing: list[str] = []
    weak: list[str] = []

    for name in _REQUIRED_PRODUCTION_SECRETS:
        value = _normalized(os.getenv(name))
        if not value:
            missing.append(name)
            continue
        if _is_weak_secret(value):
            weak.append(name)

    return SecretCheckResult(missing=missing, weak=weak)


def assert_runtime_secrets() -> None:
    if _runtime_env() not in _PRODUCTION_ENV_VALUES:
        return

    result = validate_production_secrets()
    if result.ok:
        return

    failures: list[str] = []
    if result.missing:
        failures.append(f"missing={','.join(result.missing)}")
    if result.weak:
        failures.append(f"weak={','.join(result.weak)}")
    detail = " ".join(failures)
    raise RuntimeError(f"Production secret validation failed: {detail}")


def runtime_secret_metadata() -> dict[str, str]:
    return {
        "env": _runtime_env(),
        "app_secret_key_version": _normalized(os.getenv("AIIC_APP_SECRET_KEY_VERSION", "unset")),
        "provider_keyset_version": _normalized(os.getenv("AIIC_PROVIDER_KEYSET_VERSION", "unset")),
    }
