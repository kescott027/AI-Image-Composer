from fastapi.testclient import TestClient

from apps.api.main import app


client = TestClient(app)


def _minimal_scene_spec(scene_id: str) -> dict:
    return {
        "schema_version": "0.1.0",
        "scene": {
            "id": scene_id,
            "title": "Contract Test Scene",
            "overarching_prompt": "A simple contract test"
        },
        "layers": [],
        "objects": [],
        "relations": [],
        "artifacts": [],
        "jobs": []
    }


def test_upsert_and_get_scene_spec() -> None:
    scene_id = "scene_contract_1"
    payload = _minimal_scene_spec(scene_id)

    put_response = client.put(f"/scenes/{scene_id}/spec", json=payload)
    assert put_response.status_code == 200
    assert put_response.json()["scene"]["id"] == scene_id

    get_response = client.get(f"/scenes/{scene_id}/spec")
    assert get_response.status_code == 200
    assert get_response.json()["scene"]["title"] == "Contract Test Scene"


def test_rejects_scene_id_mismatch() -> None:
    payload = _minimal_scene_spec("scene_contract_2")

    response = client.put("/scenes/scene_different/spec", json=payload)
    assert response.status_code == 400
    assert "must match" in response.json()["detail"]


def test_get_missing_scene_spec_returns_404() -> None:
    response = client.get("/scenes/scene_missing/spec")

    assert response.status_code == 404
    assert response.json()["detail"] == "SceneSpec not found"


def test_openapi_includes_scene_spec_endpoints() -> None:
    response = client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    assert "/scenes/{scene_id}/spec" in schema["paths"]
