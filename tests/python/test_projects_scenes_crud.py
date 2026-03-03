from fastapi.testclient import TestClient


def test_create_and_list_projects(db_client: TestClient) -> None:
    create_response = db_client.post(
        "/projects",
        json={"name": "Project Alpha", "description": "First project"},
    )

    assert create_response.status_code == 200
    project = create_response.json()
    assert project["id"].startswith("proj_")
    assert project["name"] == "Project Alpha"

    list_response = db_client.get("/projects")
    assert list_response.status_code == 200
    projects = list_response.json()
    assert any(p["id"] == project["id"] for p in projects)


def test_create_scene_requires_existing_project(db_client: TestClient) -> None:
    response = db_client.post(
        "/scenes",
        json={"project_id": "proj_missing", "title": "My Scene"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_create_get_and_list_scenes(db_client: TestClient) -> None:
    project_id = db_client.post("/projects", json={"name": "Project Beta"}).json()["id"]

    create_scene_response = db_client.post(
        "/scenes",
        json={"project_id": project_id, "title": "Scene One", "overarching_prompt": "sunset"},
    )
    assert create_scene_response.status_code == 200
    scene = create_scene_response.json()
    scene_id = scene["id"]

    get_scene_response = db_client.get(f"/scenes/{scene_id}")
    assert get_scene_response.status_code == 200
    assert get_scene_response.json()["title"] == "Scene One"

    list_scenes_response = db_client.get("/scenes", params={"project_id": project_id})
    assert list_scenes_response.status_code == 200
    assert any(s["id"] == scene_id for s in list_scenes_response.json())


def test_create_and_list_scene_versions(db_client: TestClient) -> None:
    project_id = db_client.post("/projects", json={"name": "Project Gamma"}).json()["id"]
    scene_id = db_client.post(
        "/scenes",
        json={"project_id": project_id, "title": "Versioned Scene"},
    ).json()["id"]

    scene_spec = {
        "schema_version": "0.1.0",
        "scene": {
            "id": scene_id,
            "title": "Versioned Scene",
            "overarching_prompt": "A version test"
        },
        "layers": [],
        "objects": [],
        "relations": [],
        "artifacts": [],
        "jobs": []
    }

    first_save = db_client.put(f"/scenes/{scene_id}/spec", json=scene_spec)
    assert first_save.status_code == 200
    assert first_save.json()["history"]["scene_version"] == 1

    second_version = db_client.post(f"/scenes/{scene_id}/versions")
    assert second_version.status_code == 200
    assert second_version.json()["version"]["version_number"] == 2

    list_versions = db_client.get(f"/scenes/{scene_id}/versions")
    assert list_versions.status_code == 200
    assert [v["version_number"] for v in list_versions.json()] == [2, 1]


def test_create_scene_bootstraps_initial_scene_spec(db_client: TestClient) -> None:
    project_id = db_client.post("/projects", json={"name": "Project Bootstrap"}).json()["id"]
    scene_id = db_client.post(
        "/scenes",
        json={"project_id": project_id, "title": "Bootstrap Scene"},
    ).json()["id"]

    spec_response = db_client.get(f"/scenes/{scene_id}/spec")
    assert spec_response.status_code == 200
    spec = spec_response.json()
    assert spec["scene"]["id"] == scene_id
    assert [layer["name"] for layer in spec["layers"]] == ["Background", "Objects", "Composite"]
