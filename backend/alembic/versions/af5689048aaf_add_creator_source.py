"""add creator source

Revision ID: af5689048aaf
Revises: a653150efff0
Create Date: 2026-09-22 16:16:51.773019

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'af5689048aaf'
down_revision: Union[str, None] = 'a653150efff0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    creator_source = sa.Enum("system", "user", name="creator_source")
    creator_source.create(op.get_bind())
    # Nullable, no default -- every creator that predates this field stays
    # unset (NULL) for manual backfill, not auto-guessed either way.
    op.add_column("creators", sa.Column("source", creator_source, nullable=True))


def downgrade() -> None:
    op.drop_column("creators", "source")
    sa.Enum(name="creator_source").drop(op.get_bind())
