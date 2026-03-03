from apps.api.db import models  # noqa: F401
from apps.api.db.base import Base

REQUIRED_TABLES = {
    "projects",
    "scenes",
    "scene_versions",
    "layers",
    "objects",
    "relations",
    "jobs",
    "artifacts",
}


def test_required_tables_present_in_metadata() -> None:
    metadata_tables = set(Base.metadata.tables.keys())
    missing = REQUIRED_TABLES.difference(metadata_tables)
    assert not missing, f"Missing required tables: {sorted(missing)}"
