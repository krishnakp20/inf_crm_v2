"""add meta and google orders

Revision ID: c4d8f2a61b73
Revises: a7c3e91f5d20
Create Date: 2026-10-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4d8f2a61b73'
down_revision: Union[str, None] = 'a7c3e91f5d20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Purely additive: two nullable whole-number columns, no existing row
    # touched (same shape as the meta_roas/google_roas columns they sit by).
    op.add_column('collaborations', sa.Column('meta_orders', sa.Integer(), nullable=True))
    op.add_column('collaborations', sa.Column('google_orders', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('collaborations', 'google_orders')
    op.drop_column('collaborations', 'meta_orders')
