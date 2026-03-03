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


def test_create_job_includes_compiled_prompt_metadata(db_client: TestClient) -> None:
    scene_id = _create_scene(db_client)
    scene_spec = {
        "scene": {
            "id": scene_id,
            "title": "Prompt Compile Scene",
            "overarching_prompt": "A lively market at sunrise",
            "negative_prompt": "blurry",
            "style_preset": "cinematic",
        },
        "objects": [
            {
                "id": "obj_person",
                "layer_id": "layer_objects",
                "name": "Person",
                "kind": "character",
                "prompt": "a traveler with a satchel",
                "negative_prompt": "deformed hands",
            },
            {
                "id": "obj_cart",
                "layer_id": "layer_objects",
                "name": "Cart",
                "kind": "prop",
                "prompt": "wooden fruit cart",
            },
        ],
        "relations": [
            {
                "id": "rel_1",
                "subject_object_id": "obj_person",
                "predicate": "LEFT_OF",
                "object_object_id": "obj_cart",
                "strength": 1.0,
            }
        ],
        "settings": {
            "defaults": {
                "palette_preset": "vibrant_pop",
                "lighting_profile": "golden_hour",
                "harmonization_strength": 0.65,
            }
        },
    }

    response = db_client.post(
        "/jobs",
        json={
            "scene_id": scene_id,
            "job_type": "OBJECT_RENDER",
            "input": {
                "scene_spec": scene_spec,
                "target_object_id": "obj_person",
            },
        },
    )

    assert response.status_code == 200
    job = response.json()
    metadata = job["input"]["metadata"]
    assert "compiled_prompt" in metadata
    assert "traveler" in metadata["compiled_prompt"].lower()
    assert "left_of" in " ".join(metadata["relation_hints"]).lower()
    assert "blurry" in metadata["compiled_negative_prompt"].lower()
    assert "palette vibrant_pop" in metadata["compiled_prompt"].lower()
    assert "lighting golden_hour" in metadata["compiled_prompt"].lower()


def test_create_scene_level_sketch_job_uses_overarching_prompt(db_client: TestClient) -> None:
    scene_id = _create_scene(db_client)
    scene_spec = {
        "scene": {
            "id": scene_id,
            "title": "Blocking Prompt Scene",
            "overarching_prompt": "A birthday party table setup in warm evening light",
            "negative_prompt": "washed out",
            "style_preset": "cinematic",
        },
        "objects": [],
        "relations": [],
    }

    response = db_client.post(
        "/jobs",
        json={
            "scene_id": scene_id,
            "job_type": "SKETCH",
            "input": {
                "scene_spec": scene_spec,
                "generation_mode": "BLOCKING",
            },
        },
    )

    assert response.status_code == 200
    job = response.json()
    metadata = job["input"]["metadata"]
    assert "compiled_prompt" in metadata
    assert "birthday party" in metadata["compiled_prompt"].lower()
    assert "blocking pass" in metadata["compiled_prompt"].lower()
