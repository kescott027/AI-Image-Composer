from fastapi.testclient import TestClient


def _create_scene(client: TestClient) -> str:
    project_response = client.post(
        "/projects",
        json={"name": "Contract Test Project", "description": "test"},
    )
    assert project_response.status_code == 200
    project_id = project_response.json()["id"]

    scene_response = client.post(
        "/scenes",
        json={"project_id": project_id, "title": "Contract Test Scene"},
    )
    assert scene_response.status_code == 200
    return scene_response.json()["id"]


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


def test_upsert_and_get_scene_spec(db_client: TestClient) -> None:
    scene_id = _create_scene(db_client)
    payload = _minimal_scene_spec(scene_id)

    put_response = db_client.put(f"/scenes/{scene_id}/spec", json=payload)
    assert put_response.status_code == 200
    assert put_response.json()["scene"]["id"] == scene_id

    get_response = db_client.get(f"/scenes/{scene_id}/spec")
    assert get_response.status_code == 200
    assert get_response.json()["scene"]["title"] == "Contract Test Scene"


def test_rejects_scene_id_mismatch(db_client: TestClient) -> None:
    scene_id = _create_scene(db_client)
    payload = _minimal_scene_spec("scene_contract_2")

    response = db_client.put(f"/scenes/{scene_id}/spec", json=payload)
    assert response.status_code == 400
    assert "must match" in response.json()["detail"]


def test_get_scene_spec_exists_after_scene_creation(db_client: TestClient) -> None:
    scene_id = _create_scene(db_client)
    response = db_client.get(f"/scenes/{scene_id}/spec")

    assert response.status_code == 200
    payload = response.json()
    assert payload["scene"]["id"] == scene_id
    assert len(payload["layers"]) == 3


def test_openapi_includes_scene_spec_endpoints(db_client: TestClient) -> None:
    response = db_client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    assert "/scenes/{scene_id}/spec" in schema["paths"]
