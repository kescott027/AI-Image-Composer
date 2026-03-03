from __future__ import annotations

from dataclasses import dataclass


_DIRECTIONAL_PREDICATES = {"LEFT_OF", "RIGHT_OF", "ABOVE", "BELOW"}
_CONTRADICTORY_BY_PREDICATE = {
    "LEFT_OF": "RIGHT_OF",
    "RIGHT_OF": "LEFT_OF",
    "ABOVE": "BELOW",
    "BELOW": "ABOVE",
}


@dataclass(frozen=True)
class RelationConflict:
    conflict_type: str
    message: str
    relation_ids: list[str]
    suggestions: list[str]


def _predicate(value: object) -> str:
    if isinstance(value, str):
        return value.strip().upper()
    return ""


def detect_relation_conflicts(scene_spec: dict[str, object]) -> list[RelationConflict]:
    relations = scene_spec.get("relations")
    if not isinstance(relations, list):
        return []

    object_name_by_id: dict[str, str] = {}
    scene_objects = scene_spec.get("objects")
    if isinstance(scene_objects, list):
        for scene_object in scene_objects:
            if not isinstance(scene_object, dict):
                continue
            object_id = scene_object.get("id")
            name = scene_object.get("name")
            if isinstance(object_id, str) and isinstance(name, str) and object_id:
                object_name_by_id[object_id] = name

    directional: list[dict[str, object]] = []
    for relation in relations:
        if not isinstance(relation, dict):
            continue
        predicate = _predicate(relation.get("predicate"))
        if predicate not in _DIRECTIONAL_PREDICATES:
            continue

        subject = relation.get("subject_object_id")
        obj = relation.get("object_object_id")
        if not isinstance(subject, str) or not isinstance(obj, str):
            continue

        directional.append(
            {
                "id": relation.get("id") if isinstance(relation.get("id"), str) else "",
                "subject": subject,
                "predicate": predicate,
                "object": obj,
            }
        )

    conflicts: list[RelationConflict] = []
    seen_signatures: set[tuple[str, tuple[str, ...]]] = set()

    # Opposing directional loops: A LEFT_OF B and B LEFT_OF A (and equivalent for other directional predicates).
    for relation in directional:
        opposite_matches = [
            candidate
            for candidate in directional
            if candidate["subject"] == relation["object"]
            and candidate["object"] == relation["subject"]
            and candidate["predicate"] == relation["predicate"]
        ]
        if not opposite_matches:
            continue

        opposite = opposite_matches[0]
        relation_ids = tuple(sorted([str(relation["id"]), str(opposite["id"])]))
        signature = ("DIRECTIONAL_LOOP", relation_ids)
        if signature in seen_signatures:
            continue
        seen_signatures.add(signature)

        subject_name = object_name_by_id.get(str(relation["subject"]), str(relation["subject"]))
        object_name = object_name_by_id.get(str(relation["object"]), str(relation["object"]))
        predicate_label = str(relation["predicate"]).lower()
        conflicts.append(
            RelationConflict(
                conflict_type="DIRECTIONAL_LOOP",
                message=(
                    f"Conflicting directional loop: {subject_name} {predicate_label} "
                    f"{object_name} and reverse relation both exist."
                ),
                relation_ids=list(relation_ids),
                suggestions=[
                    "Remove one of the opposing relations.",
                    "Replace one relation with NEAR if strict direction is not required.",
                ],
            )
        )

    # Contradictory predicates on the same ordered pair.
    pair_map: dict[tuple[str, str], set[str]] = {}
    relation_ids_by_pair_predicate: dict[tuple[str, str, str], list[str]] = {}
    for relation in directional:
        key = (str(relation["subject"]), str(relation["object"]))
        pair_map.setdefault(key, set()).add(str(relation["predicate"]))
        predicate_key = (str(relation["subject"]), str(relation["object"]), str(relation["predicate"]))
        relation_ids_by_pair_predicate.setdefault(predicate_key, []).append(str(relation["id"]))

    for key, predicates in pair_map.items():
        subject, obj = key
        for predicate in predicates:
            opposite = _CONTRADICTORY_BY_PREDICATE.get(predicate)
            if not opposite or opposite not in predicates:
                continue

            relation_ids = tuple(
                sorted(
                    relation_ids_by_pair_predicate.get((subject, obj, predicate), [])
                    + relation_ids_by_pair_predicate.get((subject, obj, opposite), [])
                )
            )
            signature = ("CONTRADICTORY_PAIR", relation_ids)
            if signature in seen_signatures:
                continue
            seen_signatures.add(signature)

            subject_name = object_name_by_id.get(subject, subject)
            object_name = object_name_by_id.get(obj, obj)
            conflicts.append(
                RelationConflict(
                    conflict_type="CONTRADICTORY_PAIR",
                    message=f"{subject_name} has both {predicate.lower()} and {opposite.lower()} relative to {object_name}.",
                    relation_ids=list(relation_ids),
                    suggestions=[
                        f"Keep only one of {predicate.lower()} or {opposite.lower()}.",
                        "If both should coexist loosely, replace with NEAR.",
                    ],
                )
            )

    return conflicts
