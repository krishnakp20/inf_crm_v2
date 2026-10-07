"""add facebook platform

Revision ID: a7c3e91f5d20
Revises: 1b4b7e5fb49f
Create Date: 2026-10-07 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a7c3e91f5d20'
down_revision: Union[str, None] = '1b4b7e5fb49f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Purely additive: one new enum label, no row data touched, so it's safe
    # inside Alembic's transaction on postgres:16 (same pattern as the roles
    # migration). IF NOT EXISTS makes it safely re-runnable.
    op.execute("ALTER TYPE platform ADD VALUE IF NOT EXISTS 'facebook'")


def downgrade() -> None:
    # Postgres has no ALTER TYPE ... DROP VALUE. A downgrade leaves the
    # 'facebook' label present but unused -- harmless to the pre-migration
    # code, which never reads or writes it.
    pass
