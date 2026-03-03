from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from uuid import uuid4

from apps.api.models.artifact_store import ArtifactRecord


@dataclass
class StoredArtifact:
    metadata: ArtifactRecord
    file_path: Path


class LocalArtifactStore:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()

    @classmethod
    def from_env(cls) -> LocalArtifactStore:
        root = Path(os.getenv("ARTIFACTS_ROOT", ".artifacts"))
        return cls(root=root)

    def create(
        self,
        *,
        data: bytes,
        filename: str | None,
        content_type: str | None,
        scene_id: str | None,
        artifact_type: str,
        subtype: str | None,
    ) -> ArtifactRecord:
        extension = self._infer_extension(filename=filename, content_type=content_type)
        artifact_id = f"art_{uuid4().hex[:12]}"
        file_name = f"{artifact_id}{extension}"
        file_path = self.root / file_name
        created_at = datetime.now(UTC).isoformat()

        metadata = ArtifactRecord(
            id=artifact_id,
            scene_id=scene_id,
            type=artifact_type,
            subtype=subtype,
            uri=f"artifact://local/{file_name}",
            filename=file_name,
            format=extension.lstrip("."),
            content_type=content_type,
            size_bytes=len(data),
            created_at=created_at,
        )

        with self._lock:
            file_path.write_bytes(data)
            self._meta_path(artifact_id).write_text(
                json.dumps(metadata.model_dump(mode="json"), indent=2),
                encoding="utf-8",
            )

        return metadata

    def get(self, artifact_id: str) -> StoredArtifact | None:
        metadata = self.get_metadata(artifact_id)
        if metadata is None:
            return None

        file_path = self.root / metadata.filename
        if not file_path.exists():
            return None

        return StoredArtifact(metadata=metadata, file_path=file_path)

    def get_metadata(self, artifact_id: str) -> ArtifactRecord | None:
        meta_path = self._meta_path(artifact_id)
        if not meta_path.exists():
            return None

        payload = json.loads(meta_path.read_text(encoding="utf-8"))
        return ArtifactRecord.model_validate(payload)

    def _meta_path(self, artifact_id: str) -> Path:
        return self.root / f"{artifact_id}.json"

    @staticmethod
    def _infer_extension(filename: str | None, content_type: str | None) -> str:
        if filename:
            suffix = Path(filename).suffix.lower()
            if suffix:
                return suffix

        if content_type == "image/png":
            return ".png"
        if content_type == "image/jpeg":
            return ".jpg"
        if content_type == "image/webp":
            return ".webp"

        return ".bin"
