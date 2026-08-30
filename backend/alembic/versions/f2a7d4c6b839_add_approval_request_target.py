"""add target to approval_requests

Revision ID: f2a7d4c6b839
Revises: e5b3c8f1a246
Create Date: 2026-08-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2a7d4c6b839'
down_revision: Union[str, None] = 'e5b3c8f1a246'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    approval_target = sa.Enum("admin", "supervisor", name="approval_target")
    approval_target.create(op.get_bind())
    # NOT NULL with a server_default backfills every existing row as
    # "admin" -- matches current real behavior, since only admin could
    # approve/reject anything before this column existed.
    op.add_column(
        "approval_requests",
        sa.Column("target", approval_target, nullable=False, server_default="admin"),
    )
    op.alter_column("approval_requests", "target", server_default=None)


def downgrade() -> None:
    op.drop_column("approval_requests", "target")
    sa.Enum(name="approval_target").drop(op.get_bind())
