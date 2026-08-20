"""add partnership hub

Revision ID: b64d7f8b3b91
Revises: 5fe1e96a0788
Create Date: 2026-08-19 23:07:04.046331

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b64d7f8b3b91'
down_revision: Union[str, None] = '5fe1e96a0788'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Both enums are used only inside create_table below (never in a bare
    # add_column), so create_table's own DDL dispatch auto-creates the
    # underlying Postgres types -- no separate explicit .create() call
    # (calling .create() AND using them in create_table in the same
    # transaction raises "type already exists", the exact gotcha hit in the
    # Campaigns migration).
    ticket_status = sa.Enum(
        "open", "pending_at_user", "pending_at_admin", "closed_and_live", name="ticket_status"
    )
    partnership_collab_status = sa.Enum(
        "open", "partnership_sent", "need_tag", "ad_code_not_working", "closed", "closed_and_live",
        name="partnership_collab_status",
    )

    op.create_table(
        "partnership_tickets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("collaboration_id", sa.Integer(), nullable=False),
        sa.Column("ticket_status", ticket_status, nullable=False, server_default="open"),
        sa.Column("collab_status", partnership_collab_status, nullable=False, server_default="open"),
        sa.Column("requested_ad_rights", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("requested_ad_code", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("requested_cta_link", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("ad_rights_creator_quote", sa.Numeric(10, 2), nullable=True),
        sa.Column("ad_rights_agent_counter", sa.Numeric(10, 2), nullable=True),
        sa.Column("ad_rights_admin_counter", sa.Numeric(10, 2), nullable=True),
        sa.Column("ad_rights_amount", sa.Numeric(10, 2), nullable=True),
        sa.Column("ad_code", sa.String(length=100), nullable=True),
        sa.Column("ad_right_duration_days", sa.Integer(), nullable=True),
        sa.Column("ad_right_expires_at", sa.Date(), nullable=True),
        sa.Column("cta_link", sa.String(length=300), nullable=True),
        sa.Column("content_bucket", sa.String(length=60), nullable=True),
        sa.Column("language", sa.String(length=60), nullable=True),
        sa.Column("response_due_at", sa.Date(), nullable=True),
        sa.Column("first_requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["collaboration_id"], ["collaborations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("collaboration_id", name="uq_partnership_tickets_collaboration_id"),
    )
    op.create_index(
        op.f("ix_partnership_tickets_collaboration_id"), "partnership_tickets", ["collaboration_id"], unique=True
    )
    op.create_index(
        op.f("ix_partnership_tickets_ticket_status"), "partnership_tickets", ["ticket_status"], unique=False
    )

    op.create_table(
        "partnership_remarks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ticket_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("tag", sa.String(length=60), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["ticket_id"], ["partnership_tickets.id"]),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_partnership_remarks_ticket_id"), "partnership_remarks", ["ticket_id"], unique=False)
    op.create_index(
        op.f("ix_partnership_remarks_created_at"), "partnership_remarks", ["created_at"], unique=False
    )

    # Backfill: ticket auto-creation (transition_collab_stage) only fires on
    # a NEW transition into Live, so every collaboration already Live before
    # this migration deploys would otherwise have zero Partnership Hub rows.
    # partnership_tickets is freshly created and empty at this point in the
    # same migration, so a plain INSERT...SELECT needs no NOT EXISTS guard.
    op.execute(
        """
        INSERT INTO partnership_tickets (collaboration_id, ticket_status, collab_status, created_at)
        SELECT id, 'open', 'open', now()
        FROM collaborations
        WHERE stage = 'live'
        """
    )


def downgrade() -> None:
    op.drop_table("partnership_remarks")
    op.drop_table("partnership_tickets")
    sa.Enum(name="partnership_collab_status").drop(op.get_bind())
    sa.Enum(name="ticket_status").drop(op.get_bind())
