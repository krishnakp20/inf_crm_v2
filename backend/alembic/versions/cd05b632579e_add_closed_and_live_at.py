"""add closed_and_live_at to partnership_tickets

Revision ID: cd05b632579e
Revises: 79391f3a3c61
Create Date: 2026-09-07 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cd05b632579e'
down_revision: Union[str, None] = '79391f3a3c61'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Stamped once, only by verify_close -- the anchor an Ad right's
    # duration-in-days is counted from, per the corrected Partnership Hub
    # flow (duration counts from when the video actually went Closed & Live,
    # not from whenever the agent happened to respond to the request).
    op.add_column("partnership_tickets", sa.Column("closed_and_live_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("partnership_tickets", "closed_and_live_at")
