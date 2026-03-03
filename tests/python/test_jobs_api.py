from fastapi.testclient import TestClient


def _create_scene(client: TestClient) -> str:
    project_id = client.post("/projects", json={"name": "Jobs Project"}).json()["id"]
    return client.post(
        "/scenes",
        json={"project_id": project_id, "title": "Jobs Scene"},
    ).json()["id"]


def test_create_and_get_job(db_client: TestClient) -> None:
    scene_id = _create_scene(db_client)

    create_response = db_client.post(
        "/jobs",
        json={
            "scene_id": scene_id,
            "job_type": "SKETCH",
            "priority": 5,
            "input": {"target_object_id": "obj_1"},
        },
    )

    assert create_response.status_code == 200
    job = create_response.json()
    assert job["id"].startswith("job_")
    assert job["scene_id"] == scene_id
    assert job["status"] == "QUEUED"
    assert job["input_hash"].startswith("sha256:")

    get_response = db_client.get(f"/jobs/{job['id']}")
    assert get_response.status_code == 200
    assert get_response.json()["id"] == job["id"]


def test_list_jobs_filters_by_status(db_client: TestClient) -> None:
    scene_id = _create_scene(db_client)

    db_client.post(
        "/jobs",
        json={"scene_id": scene_id, "job_type": "SKETCH", "priority": 1, "input": {}},
    )

    queued_response = db_client.get("/jobs", params={"status": "QUEUED", "scene_id": scene_id})
    assert queued_response.status_code == 200
    jobs = queued_response.json()
    assert len(jobs) == 1
    assert jobs[0]["status"] == "QUEUED"


def test_create_job_requires_existing_scene(db_client: TestClient) -> None:
    response = db_client.post(
        "/jobs",
        json={"scene_id": "scene_missing", "job_type": "SKETCH", "input": {}},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Scene not found"
