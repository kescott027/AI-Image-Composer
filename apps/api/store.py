from threading import Lock

from apps.api.models.scenespec import SceneSpec


class SceneSpecStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self._data: dict[str, SceneSpec] = {}

    def get(self, scene_id: str) -> SceneSpec | None:
        with self._lock:
            return self._data.get(scene_id)

    def upsert(self, scene_id: str, spec: SceneSpec) -> SceneSpec:
        with self._lock:
            self._data[scene_id] = spec
            return spec


scene_spec_store = SceneSpecStore()
