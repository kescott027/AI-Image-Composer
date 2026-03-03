from apps.api.main import app
from fastapi.testclient import TestClient


def test_api_health() -> None:
    client = TestClient(app)
    response = client.get("/health", headers={"x-request-id": "req-health-test"})

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "api"}
    assert response.headers["x-request-id"] == "req-health-test"
