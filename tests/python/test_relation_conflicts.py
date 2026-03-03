from apps.api.services.relation_conflicts import detect_relation_conflicts
from fastapi.testclient import TestClient


def _create_scene(client: TestClient) -> str:
    project_id = client.post("/projects", json={"name": "Relations Project"}).json()["id"]
    return client.post(
        "/scenes",
        json={"project_id": project_id, "title": "Relations Scene"},
    ).json()["id"]


def _base_scene_spec(scene_id: str) -> dict[str, object]:
    return {
        "schema_version": "0.1.0",
        "scene": {
            "id": scene_id,
            "title": "Relations Scene",
            "overarching_prompt": "Scene for relation validation",
        },
        "layers": [],
        "objects": [
            {
                "id": "obj_a",
                "layer_id": "layer_obj",
                "name": "A",
                "kind": "prop",
                "prompt": "Object A",
            },
            {
                "id": "obj_b",
                "layer_id": "layer_obj",
                "name": "B",
                "kind": "prop",
                "prompt": "Object B",
            },
        ],
        "relations": [],
        "artifacts": [],
        "jobs": [],
        "zones": [],
        "constraints": [],
        "settings": {
            "units": "px",
            "canvas": {"width": 820, "height": 520, "background_color": "transparent"},
            "defaults": {
                "seed_policy": "per_job",
                "sampler": "default",
                "steps": 30,
                "cfg_scale": 7,
            },
            "models": {
                "sketch_adapter": "fake_sketch_v1",
                "object_render_adapter": "fake_object_v1",
                "composite_adapter": "simple_alpha_v1",
                "zone_adapter": "simple_zone_v1",
            },
        },
        "history": {"scene_version": 0},
    }


def test_detect_relation_conflicts_finds_loop_and_contradiction() -> None:
    conflicts = detect_relation_conflicts(
        {
            "relations": [
                {
                    "id": "rel_1",
                    "subject_object_id": "obj_a",
                    "predicate": "LEFT_OF",
                    "object_object_id": "obj_b",
                },
                {
                    "id": "rel_2",
                    "subject_object_id": "obj_b",
                    "predicate": "LEFT_OF",
                    "object_object_id": "obj_a",
                },
                {
                    "id": "rel_3",
                    "subject_object_id": "obj_a",
                    "predicate": "RIGHT_OF",
                    "object_object_id": "obj_b",
                },
            ]
        }
    )

    assert len(conflicts) == 2
    conflict_types = {conflict.conflict_type for conflict in conflicts}
    assert "DIRECTIONAL_LOOP" in conflict_types
    assert "CONTRADICTORY_PAIR" in conflict_types


def test_detect_relation_conflicts_endpoint_with_payload(db_client: TestClient) -> None:
    scene_id = _create_scene(db_client)
    payload = _base_scene_spec(scene_id)
    payload["relations"] = [
        {
            "id": "rel_loop_1",
            "subject_object_id": "obj_a",
            "predicate": "ABOVE",
            "object_object_id": "obj_b",
            "strength": 1,
        },
        {
            "id": "rel_loop_2",
            "subject_object_id": "obj_b",
            "predicate": "ABOVE",
            "object_object_id": "obj_a",
            "strength": 1,
        },
    ]

    response = db_client.post(f"/scenes/{scene_id}/relation-conflicts", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["conflict_type"] == "DIRECTIONAL_LOOP"
    assert set(body[0]["relation_ids"]) == {"rel_loop_1", "rel_loop_2"}


def test_detect_relation_conflicts_endpoint_uses_saved_spec_when_payload_is_null(
    db_client: TestClient,
) -> None:
    scene_id = _create_scene(db_client)
    payload = _base_scene_spec(scene_id)
    payload["relations"] = [
        {
            "id": "rel_1",
            "subject_object_id": "obj_a",
            "predicate": "LEFT_OF",
            "object_object_id": "obj_b",
            "strength": 1,
        },
        {
            "id": "rel_2",
            "subject_object_id": "obj_a",
            "predicate": "RIGHT_OF",
            "object_object_id": "obj_b",
            "strength": 1,
        },
    ]
    put_response = db_client.put(f"/scenes/{scene_id}/spec", json=payload)
    assert put_response.status_code == 200

    response = db_client.post(f"/scenes/{scene_id}/relation-conflicts", json=None)

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["conflict_type"] == "CONTRADICTORY_PAIR"
