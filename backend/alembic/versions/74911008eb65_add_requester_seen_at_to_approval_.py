"""add requester_seen_at to approval_requests

Revision ID: 74911008eb65
Revises: 37ce97b3ef09
Create Date: 2026-09-10 15:00:58.430953

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '74911008eb65'
down_revision: Union[str, None] = '37ce97b3ef09'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("approval_requests", sa.Column("requester_seen_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("approval_requests", "requester_seen_at")
