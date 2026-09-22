"""add unassigned placeholder user

Revision ID: 4b18807cf61c
Revises: e084eeea6bea
Create Date: 2026-09-22 14:57:52.240371

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4b18807cf61c'
down_revision: Union[str, None] = 'e084eeea6bea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Fixed email, looked up by app.core.constants.UNASSIGNED_OWNER_EMAIL --
# not a real inbox, just a stable key to find this one seeded row by.
_EMAIL = "unassigned@system.internal"
# A real, valid bcrypt hash (via the app's own passlib hash_password) of a
# random password that was never recorded anywhere -- not a fake/malformed
# string, so verify_password() never errors on a login attempt against
# this account. Login is blocked regardless by is_active=False, checked in
# routes/auth.py, but that check runs AFTER password verification, so the
# hash still needs to be a well-formed one no password will ever match.
_PASSWORD_HASH = "$2b$12$6ztGOwqLVWAkIKz/qI8zxO4ncrpnyhMJzIPieqD.yIbajnS5eqIEa"


def upgrade() -> None:
    users_table = sa.table(
        "users",
        sa.column("name", sa.String),
        sa.column("email", sa.String),
        sa.column("password_hash", sa.String),
        sa.column("role", sa.String),
        sa.column("is_active", sa.Boolean),
        sa.column("must_change_password", sa.Boolean),
    )
    op.bulk_insert(
        users_table,
        [
            {
                "name": "Unassigned",
                "email": _EMAIL,
                "password_hash": _PASSWORD_HASH,
                "role": "advisor",
                "is_active": False,
                "must_change_password": False,
            }
        ],
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM users WHERE email = :email").bindparams(email=_EMAIL))
