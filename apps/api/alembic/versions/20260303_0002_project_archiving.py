"""Add project archiving column

Revision ID: 20260303_0002
Revises: 20260302_0001
Create Date: 2026-03-03 14:55:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260303_0002"
down_revision: str | None = "20260302_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_projects_archived_at", "projects", ["archived_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_projects_archived_at", table_name="projects")
    op.drop_column("projects", "archived_at")
