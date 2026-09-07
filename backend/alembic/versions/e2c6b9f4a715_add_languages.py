"""add languages table

Revision ID: e2c6b9f4a715
Revises: d8f3a6c1e470
Create Date: 2026-09-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2c6b9f4a715'
down_revision: Union[str, None] = 'd8f3a6c1e470'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Seeded with the reference site's fixed language list as a sensible
# starting point -- admin can add/remove from here in Settings.
_SEED_LANGUAGES = ["Hindi", "Hinglish", "English", "Telugu", "Marathi", "Tamil", "Kannada", "Bengali"]


def upgrade() -> None:
    op.create_table(
        "languages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=60), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    languages_table = sa.table("languages", sa.column("name", sa.String))
    op.bulk_insert(languages_table, [{"name": name} for name in _SEED_LANGUAGES])


def downgrade() -> None:
    op.drop_table("languages")
