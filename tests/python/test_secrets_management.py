import pytest
from apps.api.security.secrets import assert_runtime_secrets, runtime_secret_metadata


def test_non_production_allows_missing_secret(monkeypatch) -> None:
    monkeypatch.setenv("AIIC_ENV", "development")
    monkeypatch.delenv("AIIC_APP_SECRET_KEY", raising=False)

    assert_runtime_secrets()


def test_production_requires_app_secret(monkeypatch) -> None:
    monkeypatch.setenv("AIIC_ENV", "production")
    monkeypatch.delenv("AIIC_APP_SECRET_KEY", raising=False)

    with pytest.raises(RuntimeError, match="missing=AIIC_APP_SECRET_KEY"):
        assert_runtime_secrets()


def test_production_rejects_weak_secret(monkeypatch) -> None:
    monkeypatch.setenv("AIIC_ENV", "production")
    monkeypatch.setenv("AIIC_APP_SECRET_KEY", "changeme123")

    with pytest.raises(RuntimeError, match="weak=AIIC_APP_SECRET_KEY"):
        assert_runtime_secrets()


def test_production_accepts_strong_secret(monkeypatch) -> None:
    monkeypatch.setenv("AIIC_ENV", "production")
    monkeypatch.setenv("AIIC_APP_SECRET_KEY", "J5y6G7h8K9l0M1n2P3q4")
    monkeypatch.setenv("AIIC_APP_SECRET_KEY_VERSION", "v42")
    monkeypatch.setenv("AIIC_PROVIDER_KEYSET_VERSION", "provider-2026-03")

    assert_runtime_secrets()
    metadata = runtime_secret_metadata()

    assert metadata["env"] == "production"
    assert metadata["app_secret_key_version"] == "v42"
    assert metadata["provider_keyset_version"] == "provider-2026-03"
