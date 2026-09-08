"""add content_buckets and creator_category_tiers

Revision ID: 95f40b44c0a1
Revises: c901e44aa53f
Create Date: 2026-09-07 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '95f40b44c0a1'
down_revision: Union[str, None] = 'c901e44aa53f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "content_buckets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "creator_category_tiers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("min_followers", sa.Integer(), nullable=False),
        sa.Column("max_followers", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.CheckConstraint("min_followers >= 0", name="ck_creator_category_tier_min_nonneg"),
    )


def downgrade() -> None:
    op.drop_table("creator_category_tiers")
    op.drop_table("content_buckets")
