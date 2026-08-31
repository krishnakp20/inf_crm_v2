"""add video_live_date to collaborations

Revision ID: b3d8f1a6c294
Revises: a1c4e9d7f052
Create Date: 2026-08-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3d8f1a6c294'
down_revision: Union[str, None] = 'a1c4e9d7f052'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("collaborations", sa.Column("video_live_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("collaborations", "video_live_date")
