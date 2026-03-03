from pathlib import Path

from fastapi.testclient import TestClient

from apps.api import main
from apps.api.services.artifact_store import LocalArtifactStore


def _client_with_temp_store(tmp_path: Path, monkeypatch) -> TestClient:
    monkeypatch.setattr(main, "artifact_store", LocalArtifactStore(tmp_path))
    return TestClient(main.app)


def test_upload_and_retrieve_artifact(tmp_path: Path, monkeypatch) -> None:
    client = _client_with_temp_store(tmp_path, monkeypatch)

    response = client.post(
        "/artifacts/upload",
        data={"scene_id": "scene_123", "artifact_type": "IMAGE", "subtype": "WIRE"},
        files={"file": ("wireframe.png", b"fake-image-data", "image/png")},
    )

    assert response.status_code == 200
    payload = response.json()
    artifact_id = payload["id"]

    assert payload["scene_id"] == "scene_123"
    assert payload["type"] == "IMAGE"
    assert payload["subtype"] == "WIRE"
    assert payload["uri"].startswith("artifact://local/art_")
    assert payload["filename"].endswith(".png")
    assert payload["size_bytes"] == len(b"fake-image-data")

    metadata_response = client.get(f"/artifacts/{artifact_id}/meta")
    assert metadata_response.status_code == 200
    assert metadata_response.json()["id"] == artifact_id

    file_response = client.get(f"/artifacts/{artifact_id}")
    assert file_response.status_code == 200
    assert file_response.content == b"fake-image-data"


def test_missing_artifact_returns_404(tmp_path: Path, monkeypatch) -> None:
    client = _client_with_temp_store(tmp_path, monkeypatch)

    metadata_response = client.get("/artifacts/art_missing/meta")
    assert metadata_response.status_code == 404

    file_response = client.get("/artifacts/art_missing")
    assert file_response.status_code == 404
