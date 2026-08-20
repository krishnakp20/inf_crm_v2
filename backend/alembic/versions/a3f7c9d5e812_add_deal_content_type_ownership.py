"""add deal/content type tags and ownership_revoked_at

Revision ID: a3f7c9d5e812
Revises: c1a9e4f2a3d7
Create Date: 2026-08-20 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f7c9d5e812'
down_revision: Union[str, None] = 'c1a9e4f2a3d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Additive nullable columns on the pre-existing, live `collaborations`
    # table. add_column does NOT auto-create a referenced enum type the way
    # create_table does -- each enum needs an explicit .create() call before
    # its column is added (the gotcha documented in 5fe1e96a0788/b64d7f8b3b91).
    deal_type_enum = sa.Enum("paid", "barter", name="deal_type")
    content_type_enum = sa.Enum("integrated", "dedicated", name="content_type")
    deal_type_enum.create(op.get_bind())
    content_type_enum.create(op.get_bind())

    op.add_column("collaborations", sa.Column("deal_type", deal_type_enum, nullable=True))
    op.add_column("collaborations", sa.Column("content_type", content_type_enum, nullable=True))
    op.add_column("collaborations", sa.Column("ownership_revoked_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("collaborations", "ownership_revoked_at")
    op.drop_column("collaborations", "content_type")
    op.drop_column("collaborations", "deal_type")

    # Safe to genuinely DROP these types (unlike ALTER TYPE ADD VALUE on an
    # existing type): they're brand new from this migration, so nothing else
    # can reference them once the columns above are gone. Drop AFTER the
    # columns, matching 5fe1e96a0788's ordering.
    sa.Enum(name="content_type").drop(op.get_bind())
    sa.Enum(name="deal_type").drop(op.get_bind())
