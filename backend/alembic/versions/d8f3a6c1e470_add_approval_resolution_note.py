"""add resolution_note to approval_requests

Revision ID: d8f3a6c1e470
Revises: c7d1a4e9b358
Create Date: 2026-09-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8f3a6c1e470'
down_revision: Union[str, None] = 'c7d1a4e9b358'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Additive nullable column -- only ever set on reject.
    op.add_column("approval_requests", sa.Column("resolution_note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("approval_requests", "resolution_note")
