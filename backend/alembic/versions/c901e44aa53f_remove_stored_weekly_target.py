"""remove stored weekly_target from product_targets

Revision ID: c901e44aa53f
Revises: cd05b632579e
Create Date: 2026-09-07 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c901e44aa53f'
down_revision: Union[str, None] = 'cd05b632579e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # An agent now sets only a monthly target -- weekly is always derived at
    # read time from monthly_target and the current month's day count (see
    # services/product_targets.py), never stored, so it can't go stale
    # across a month boundary. Safe to drop: fully re-derivable, no data
    # loss in what actually matters (monthly_target is untouched).
    op.drop_column("product_targets", "weekly_target")


def downgrade() -> None:
    op.add_column("product_targets", sa.Column("weekly_target", sa.Integer(), nullable=False, server_default="0"))
    op.alter_column("product_targets", "weekly_target", server_default=None)
