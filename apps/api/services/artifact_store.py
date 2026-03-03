from __future__ import annotations

import hashlib
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


class ArtifactIntegrityError(Exception):
    pass


class LocalArtifactStore:
    def __init__(self, root: Path, immutable_mode: bool = False) -> None:
        self.root = root
        self.immutable_mode = immutable_mode
        self.root.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()

    @classmethod
    def from_env(cls) -> LocalArtifactStore:
        root = Path(os.getenv("ARTIFACTS_ROOT", ".artifacts"))
        immutable_mode = os.getenv("AIIC_ARTIFACT_IMMUTABLE_MODE", "false").lower() in {
            "1",
            "true",
            "yes",
            "on",
        }
        return cls(root=root, immutable_mode=immutable_mode)

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
            checksum_sha256=hashlib.sha256(data).hexdigest(),
            immutable=self.immutable_mode,
            created_at=created_at,
        )

        with self._lock:
            file_path.write_bytes(data)
            meta_path = self._meta_path(artifact_id)
            meta_path.write_text(
                json.dumps(metadata.model_dump(mode="json"), indent=2),
                encoding="utf-8",
            )
            if self.immutable_mode:
                self._set_read_only(file_path)
                self._set_read_only(meta_path)

        return metadata

    def get(self, artifact_id: str) -> StoredArtifact | None:
        metadata = self.get_metadata(artifact_id)
        if metadata is None:
            return None

        file_path = self.root / metadata.filename
        if not file_path.exists():
            return None

        actual_checksum = self._sha256_for_file(file_path)
        if metadata.checksum_sha256 != actual_checksum:
            raise ArtifactIntegrityError(
                f"Checksum mismatch for artifact {artifact_id}: "
                f"expected {metadata.checksum_sha256}, got {actual_checksum}"
            )

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
    def _set_read_only(path: Path) -> None:
        try:
            path.chmod(0o444)
        except OSError:
            # Best-effort: do not fail artifact creation on unsupported filesystems.
            return

    @staticmethod
    def _sha256_for_file(file_path: Path) -> str:
        digest = hashlib.sha256()
        with file_path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(65536), b""):
                digest.update(chunk)
        return digest.hexdigest()

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
