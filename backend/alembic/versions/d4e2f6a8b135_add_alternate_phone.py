"""add alternate_phone to creators

Revision ID: d4e2f6a8b135
Revises: b1e6a4f0c923
Create Date: 2026-08-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e2f6a8b135'
down_revision: Union[str, None] = 'b1e6a4f0c923'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Additive nullable column, plain string -- no enum involved.
    op.add_column("creators", sa.Column("alternate_phone", sa.String(length=30), nullable=True))


def downgrade() -> None:
    op.drop_column("creators", "alternate_phone")
