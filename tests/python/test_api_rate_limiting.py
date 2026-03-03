import apps.api.main as main
from apps.api.services.rate_limiter import RateLimiter
from fastapi.testclient import TestClient


def test_rate_limiting_blocks_after_max_requests(monkeypatch) -> None:
    limiter = RateLimiter(
        enabled=True,
        window_seconds=60,
        max_requests=2,
        exempt_paths={"/health"},
    )
    monkeypatch.setattr(main, "rate_limiter", limiter)

    with TestClient(main.app) as client:
        first = client.get("/openapi.json")
        second = client.get("/openapi.json")
        third = client.get("/openapi.json")

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
    assert third.json()["detail"] == "Rate limit exceeded. Please retry later."
    assert third.headers["x-ratelimit-limit"] == "2"
    assert third.headers["x-ratelimit-remaining"] == "0"
    assert "retry-after" in third.headers
    assert "x-request-id" in third.headers


def test_rate_limiter_reset_clears_bucket(monkeypatch) -> None:
    limiter = RateLimiter(
        enabled=True,
        window_seconds=60,
        max_requests=1,
        exempt_paths={"/health"},
    )
    monkeypatch.setattr(main, "rate_limiter", limiter)

    with TestClient(main.app) as client:
        first = client.get("/openapi.json")
        blocked = client.get("/openapi.json")
        main.reset_rate_limiter_state()
        after_reset = client.get("/openapi.json")

    assert first.status_code == 200
    assert blocked.status_code == 429
    assert after_reset.status_code == 200


def test_rate_limiter_exempts_health_path(monkeypatch) -> None:
    limiter = RateLimiter(
        enabled=True,
        window_seconds=60,
        max_requests=1,
        exempt_paths={"/health"},
    )
    monkeypatch.setattr(main, "rate_limiter", limiter)

    with TestClient(main.app) as client:
        first = client.get("/health")
        second = client.get("/health")
        third = client.get("/health")

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 200


def test_rate_limiter_preserves_incoming_request_id(monkeypatch) -> None:
    limiter = RateLimiter(
        enabled=True,
        window_seconds=60,
        max_requests=1,
        exempt_paths={"/health"},
    )
    monkeypatch.setattr(main, "rate_limiter", limiter)

    with TestClient(main.app) as client:
        response = client.get("/openapi.json", headers={"x-request-id": "req-custom-id"})

    assert response.status_code == 200
    assert response.headers["x-request-id"] == "req-custom-id"
