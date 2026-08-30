"""add event_type/actor_id/note to ownership_events

Revision ID: e5b3c8f1a246
Revises: d4e2f6a8b135
Create Date: 2026-08-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5b3c8f1a246'
down_revision: Union[str, None] = 'd4e2f6a8b135'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    ownership_event_type = sa.Enum(
        "assigned", "transferred", "admin_assigned", "revoked", name="ownership_event_type"
    )
    ownership_event_type.create(op.get_bind())
    op.add_column("ownership_events", sa.Column("event_type", ownership_event_type, nullable=True))
    op.add_column("ownership_events", sa.Column("actor_id", sa.Integer(), nullable=True))
    op.add_column("ownership_events", sa.Column("note", sa.String(length=300), nullable=True))
    op.create_foreign_key(
        "ownership_events_actor_id_fkey", "ownership_events", "users", ["actor_id"], ["id"]
    )


def downgrade() -> None:
    op.drop_constraint("ownership_events_actor_id_fkey", "ownership_events", type_="foreignkey")
    op.drop_column("ownership_events", "note")
    op.drop_column("ownership_events", "actor_id")
    op.drop_column("ownership_events", "event_type")
    sa.Enum(name="ownership_event_type").drop(op.get_bind())
