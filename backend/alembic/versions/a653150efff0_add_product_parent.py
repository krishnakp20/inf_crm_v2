"""add product parent

Revision ID: a653150efff0
Revises: 4b18807cf61c
Create Date: 2026-09-22 15:35:43.345614

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a653150efff0'
down_revision: Union[str, None] = '4b18807cf61c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("products", sa.Column("parent", sa.String(length=120), nullable=True))
    op.create_index(op.f("ix_products_parent"), "products", ["parent"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_products_parent"), table_name="products")
    op.drop_column("products", "parent")
