"""add content categories

Revision ID: e084eeea6bea
Revises: 74911008eb65
Create Date: 2026-09-17 13:33:49.607308

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e084eeea6bea'
down_revision: Union[str, None] = '74911008eb65'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Seeded with the client's own starting list as a sensible default -- admin
# can add/remove from here in Settings.
_SEED_CATEGORIES = [
    "Beauty & Personal Care",
    "Fashion & Lifestyle",
    "Food & Cooking",
    "Fitness & Wellness",
    "Family & Relationships",
    "Entertainment",
    "Travel",
    "Creative & Hobbies",
    "Regional Creators",
    "UGC Creators",
    "Celebrity & Public Figures",
]


def upgrade() -> None:
    op.create_table(
        "content_categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=60), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    categories_table = sa.table("content_categories", sa.column("name", sa.String))
    op.bulk_insert(categories_table, [{"name": name} for name in _SEED_CATEGORIES])


def downgrade() -> None:
    op.drop_table("content_categories")
