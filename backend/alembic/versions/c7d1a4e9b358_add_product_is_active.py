"""add is_active to products

Revision ID: c7d1a4e9b358
Revises: b3d8f1a6c294
Create Date: 2026-09-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7d1a4e9b358'
down_revision: Union[str, None] = 'b3d8f1a6c294'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Additive, NOT NULL with a server default -- backfills every existing
    # product to active (true) in place, no app downtime.
    op.add_column(
        "products",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("products", "is_active")
