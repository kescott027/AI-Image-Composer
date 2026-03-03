from pathlib import Path

from apps.api import main
from apps.api.services.artifact_store import LocalArtifactStore
from fastapi.testclient import TestClient


def _client_with_temp_store(
    tmp_path: Path, monkeypatch, *, immutable_mode: bool = False
) -> TestClient:
    monkeypatch.setattr(main, "artifact_store", LocalArtifactStore(tmp_path, immutable_mode))
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
    assert len(payload["checksum_sha256"]) == 64

    metadata_response = client.get(f"/artifacts/{artifact_id}/meta")
    assert metadata_response.status_code == 200
    assert metadata_response.json()["id"] == artifact_id
    assert metadata_response.json()["checksum_sha256"] == payload["checksum_sha256"]

    file_response = client.get(f"/artifacts/{artifact_id}")
    assert file_response.status_code == 200
    assert file_response.content == b"fake-image-data"


def test_missing_artifact_returns_404(tmp_path: Path, monkeypatch) -> None:
    client = _client_with_temp_store(tmp_path, monkeypatch)

    metadata_response = client.get("/artifacts/art_missing/meta")
    assert metadata_response.status_code == 404

    file_response = client.get("/artifacts/art_missing")
    assert file_response.status_code == 404


def test_tampered_artifact_returns_409(tmp_path: Path, monkeypatch) -> None:
    client = _client_with_temp_store(tmp_path, monkeypatch)

    response = client.post(
        "/artifacts/upload",
        data={"scene_id": "scene_123", "artifact_type": "IMAGE", "subtype": "WIRE"},
        files={"file": ("wireframe.png", b"original-bytes", "image/png")},
    )
    assert response.status_code == 200
    payload = response.json()

    tampered_file = tmp_path / payload["filename"]
    tampered_file.write_bytes(b"tampered-bytes")

    file_response = client.get(f"/artifacts/{payload['id']}")
    assert file_response.status_code == 409
    assert "Checksum mismatch" in file_response.json()["detail"]


def test_upload_artifact_immutable_mode_sets_read_only_files(tmp_path: Path, monkeypatch) -> None:
    client = _client_with_temp_store(tmp_path, monkeypatch, immutable_mode=True)

    response = client.post(
        "/artifacts/upload",
        data={"scene_id": "scene_immutable", "artifact_type": "IMAGE", "subtype": "WIRE"},
        files={"file": ("wireframe.png", b"immutable-bytes", "image/png")},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["immutable"] is True

    file_path = tmp_path / payload["filename"]
    meta_path = tmp_path / f"{payload['id']}.json"
    assert file_path.exists()
    assert meta_path.exists()
    assert file_path.stat().st_mode & 0o222 == 0
    assert meta_path.stat().st_mode & 0o222 == 0
