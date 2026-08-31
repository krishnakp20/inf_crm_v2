"""add product variants (shades)

Revision ID: a1c4e9d7f052
Revises: f2a7d4c6b839
Create Date: 2026-08-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c4e9d7f052'
down_revision: Union[str, None] = 'f2a7d4c6b839'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "product_variants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("product_id", "name"),
    )
    op.create_index("ix_product_variants_product_id", "product_variants", ["product_id"])

    op.add_column("collaboration_products", sa.Column("variant_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "collaboration_products_variant_id_fkey",
        "collaboration_products",
        "product_variants",
        ["variant_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("collaboration_products_variant_id_fkey", "collaboration_products", type_="foreignkey")
    op.drop_column("collaboration_products", "variant_id")
    op.drop_index("ix_product_variants_product_id", table_name="product_variants")
    op.drop_table("product_variants")
