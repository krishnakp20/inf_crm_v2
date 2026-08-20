"""add poc_code and video_link

Revision ID: b1e6a4f0c923
Revises: a3f7c9d5e812
Create Date: 2026-08-20 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1e6a4f0c923'
down_revision: Union[str, None] = 'a3f7c9d5e812'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Additive nullable columns, no enum involved -- plain add_column is safe
    # as-is (no double-creation gotcha since these are plain strings).
    op.add_column("collaborations", sa.Column("poc_code", sa.String(length=60), nullable=True))
    op.add_column("collaborations", sa.Column("video_link", sa.String(length=300), nullable=True))


def downgrade() -> None:
    op.drop_column("collaborations", "video_link")
    op.drop_column("collaborations", "poc_code")
