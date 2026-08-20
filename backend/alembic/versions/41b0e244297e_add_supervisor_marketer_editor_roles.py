"""add supervisor marketer editor roles

Revision ID: 41b0e244297e
Revises: 6242f5c1fc98
Create Date: 2026-08-19 20:31:30.836558

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '41b0e244297e'
down_revision: Union[str, None] = '6242f5c1fc98'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # New enum labels. Postgres 12+ (this project runs postgres:16) allows
    # ALTER TYPE ... ADD VALUE inside a transaction as long as the new value
    # is not read or written in that same transaction -- this migration
    # doesn't touch any row data, so it's safe inside Alembic's default
    # single-transaction wrapper. IF NOT EXISTS makes it safely re-runnable.
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'supervisor'")
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'marketer'")
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'editor'")

    op.add_column('users', sa.Column('supervisor_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_users_supervisor_id'), 'users', ['supervisor_id'], unique=False)
    op.create_foreign_key(
        'fk_users_supervisor_id_users', 'users', 'users', ['supervisor_id'], ['id'], ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint('fk_users_supervisor_id_users', 'users', type_='foreignkey')
    op.drop_index(op.f('ix_users_supervisor_id'), table_name='users')
    op.drop_column('users', 'supervisor_id')
    # NOTE: Postgres has no ALTER TYPE ... DROP VALUE. A downgrade leaves the
    # 'supervisor'/'marketer'/'editor' labels present but unused in user_role
    # -- a documented, accepted Postgres limitation. Once supervisor_id is
    # gone (dropped above), no row can reference those roles in a way that
    # matters to the app, so the app behaves exactly as it did pre-migration.
