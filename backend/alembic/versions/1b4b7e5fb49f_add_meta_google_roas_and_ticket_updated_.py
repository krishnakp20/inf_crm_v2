"""add meta google roas and ticket updated_at

Revision ID: 1b4b7e5fb49f
Revises: af5689048aaf
Create Date: 2026-09-28 13:39:43.549004

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1b4b7e5fb49f'
down_revision: Union[str, None] = 'af5689048aaf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("collaborations", sa.Column("meta_roas", sa.Numeric(6, 2), nullable=True))
    op.add_column("collaborations", sa.Column("google_roas", sa.Numeric(6, 2), nullable=True))
    # NOT NULL with a server_default backfills every existing ticket's
    # updated_at to "now" -- there's no real prior update timestamp to
    # recover, and this is a display-only field (Partnership Hub's export),
    # not something anything else branches logic on.
    op.add_column(
        "partnership_tickets",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_column("partnership_tickets", "updated_at")
    op.drop_column("collaborations", "google_roas")
    op.drop_column("collaborations", "meta_roas")
