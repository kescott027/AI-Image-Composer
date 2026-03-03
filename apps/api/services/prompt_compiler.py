from dataclasses import dataclass


@dataclass
class CompiledPrompt:
    text: str
    negative: str
    relation_hints: list[str]


def _text(value: object) -> str:
    if isinstance(value, str):
        return value.strip()
    return ""


def _object_lookup(scene_spec: dict[str, object]) -> dict[str, dict[str, object]]:
    objects = scene_spec.get("objects")
    if not isinstance(objects, list):
        return {}

    lookup: dict[str, dict[str, object]] = {}
    for object_payload in objects:
        if not isinstance(object_payload, dict):
            continue
        object_id = object_payload.get("id")
        if isinstance(object_id, str) and object_id:
            lookup[object_id] = object_payload
    return lookup


def _relation_hints(
    scene_spec: dict[str, object],
    target_object_id: str | None,
    object_lookup: dict[str, dict[str, object]],
) -> list[str]:
    relations = scene_spec.get("relations")
    if not isinstance(relations, list):
        return []

    hints: list[str] = []
    for relation in relations:
        if not isinstance(relation, dict):
            continue
        subject_id = relation.get("subject_object_id")
        object_id = relation.get("object_object_id")
        predicate = _text(relation.get("predicate")).lower()
        if not predicate:
            continue

        if target_object_id and subject_id != target_object_id and object_id != target_object_id:
            continue

        if isinstance(subject_id, str):
            subject_name = _text(object_lookup.get(subject_id, {}).get("name")) or subject_id
        else:
            subject_name = "unknown"
        if isinstance(object_id, str):
            object_name = _text(object_lookup.get(object_id, {}).get("name")) or object_id
        else:
            object_name = "unknown"

        hints.append(f"{subject_name} {predicate} {object_name}")

    return hints


def compile_prompt_for_job(
    scene_spec: dict[str, object],
    job_type: str,
    target_object_id: str | None,
) -> CompiledPrompt:
    scene = scene_spec.get("scene") if isinstance(scene_spec.get("scene"), dict) else {}
    scene_prompt = _text(scene.get("overarching_prompt"))
    scene_negative = _text(scene.get("negative_prompt"))
    style_preset = _text(scene.get("style_preset"))

    object_lookup = _object_lookup(scene_spec)
    target_object = object_lookup.get(target_object_id) if target_object_id else None
    object_prompt = _text(target_object.get("prompt")) if isinstance(target_object, dict) else ""
    object_negative = _text(target_object.get("negative_prompt")) if isinstance(target_object, dict) else ""
    object_name = _text(target_object.get("name")) if isinstance(target_object, dict) else ""

    hints = _relation_hints(scene_spec, target_object_id, object_lookup)

    if job_type == "SKETCH":
        segments = [
            object_name,
            object_prompt,
            f"style {style_preset}" if style_preset else "",
            " ; ".join(hints[:2]),
        ]
    elif job_type == "OBJECT_RENDER":
        segments = [
            scene_prompt,
            f"subject: {object_name}" if object_name else "",
            object_prompt,
            " ; ".join(hints),
            f"style {style_preset}" if style_preset else "",
        ]
    elif job_type == "FINAL_COMPOSITE":
        segments = [
            scene_prompt,
            f"style {style_preset}" if style_preset else "",
            "scene-wide composite",
        ]
    else:
        segments = [scene_prompt, object_prompt, f"style {style_preset}" if style_preset else ""]

    compiled_text = ". ".join(segment for segment in segments if segment)
    compiled_negative = ", ".join(part for part in [scene_negative, object_negative] if part)

    return CompiledPrompt(
        text=compiled_text,
        negative=compiled_negative,
        relation_hints=hints,
    )
