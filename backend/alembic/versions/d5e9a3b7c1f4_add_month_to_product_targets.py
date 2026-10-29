"""add month to product_targets

Revision ID: d5e9a3b7c1f4
Revises: c4d8f2a61b73
Create Date: 2026-10-29 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5e9a3b7c1f4'
down_revision: Union[str, None] = 'c4d8f2a61b73'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Additive: a nullable first-of-month date. Every existing row keeps month
    # NULL, which means "standing target" -- it keeps applying to any month that
    # has no figure of its own, so nothing already set changes meaning.
    op.add_column('product_targets', sa.Column('month', sa.Date(), nullable=True))
    # One row per user+product+month; Postgres treats NULLs as distinct, so a
    # partial unique index keeps it to a single standing (NULL-month) row too.
    op.drop_constraint('uq_product_target_user_product', 'product_targets', type_='unique')
    op.create_unique_constraint(
        'uq_product_target_user_product_month', 'product_targets', ['user_id', 'product_id', 'month']
    )
    op.create_index(
        'uq_product_target_standing',
        'product_targets',
        ['user_id', 'product_id'],
        unique=True,
        postgresql_where=sa.text('month IS NULL'),
    )


def downgrade() -> None:
    op.drop_index('uq_product_target_standing', table_name='product_targets')
    # Month-specific rows cannot exist under the old one-row-per-user+product
    # rule; they are removed (the standing rows are untouched).
    op.execute('DELETE FROM product_targets WHERE month IS NOT NULL')
    op.drop_constraint('uq_product_target_user_product_month', 'product_targets', type_='unique')
    op.create_unique_constraint('uq_product_target_user_product', 'product_targets', ['user_id', 'product_id'])
    op.drop_column('product_targets', 'month')
