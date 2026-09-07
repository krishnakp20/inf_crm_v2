"""fix stage_deadline_rules to use CollabStage (the real Kanban stages)

Revision ID: 79391f3a3c61
Revises: e2c6b9f4a715
Create Date: 2026-09-07 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '79391f3a3c61'
down_revision: Union[str, None] = 'e2c6b9f4a715'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CREATOR_STAGE_VALUES = (
    "new_lead", "outreach_sent", "replied", "negotiating", "commercial_locked",
    "product_sent", "content_review", "live", "payment_pending", "paid",
)
COLLAB_STAGE_VALUES = (
    "new_lead", "replied", "negotiating", "commercial_locked", "product_sent",
    "product_delivered", "first_draft", "approved", "live", "dead_leads",
)


def upgrade() -> None:
    # stage_deadline_rules.stage was wired to CreatorStage from day one --
    # a list that doesn't match the real Kanban board My Creators actually
    # uses (CollabStage). CreatorStage has "Outreach sent"/"Payment"/"Paid"
    # which don't exist there, and is missing "Product Delivered"/
    # "First Draft"/"Approved" which do. No admin has ever actually edited
    # a value here -- every existing row shares the exact same seed-time
    # updated_at from the initial migration -- so it's safe to wipe rather
    # than migrate data that was never a deliberate business rule.
    op.execute("DELETE FROM stage_deadline_rules")
    op.drop_constraint("stage_deadline_rules_stage_key", "stage_deadline_rules", type_="unique")
    op.drop_column("stage_deadline_rules", "stage")

    # collab_stage already exists (created by the initial migration for
    # collaborations.stage) -- create_type=False reuses it instead of
    # re-creating it.
    collab_stage_enum = sa.Enum(*COLLAB_STAGE_VALUES, name="collab_stage", create_type=False)
    op.add_column("stage_deadline_rules", sa.Column("stage", collab_stage_enum, nullable=False))
    op.create_unique_constraint("stage_deadline_rules_stage_key", "stage_deadline_rules", ["stage"])

    # Deliberately ships with every stage unconfigured ("No deadline") --
    # the old fixed 2-4 day Overdue thresholds were never meant as
    # auto-archive triggers, and seeding them here would auto-archive a
    # large number of currently-overdue real leads on the first sweep.
    # An admin sets real day-counts per stage when ready.


def downgrade() -> None:
    op.execute("DELETE FROM stage_deadline_rules")
    op.drop_constraint("stage_deadline_rules_stage_key", "stage_deadline_rules", type_="unique")
    op.drop_column("stage_deadline_rules", "stage")

    creator_stage_enum = sa.Enum(*CREATOR_STAGE_VALUES, name="creator_stage", create_type=False)
    op.add_column("stage_deadline_rules", sa.Column("stage", creator_stage_enum, nullable=False))
    op.create_unique_constraint("stage_deadline_rules_stage_key", "stage_deadline_rules", ["stage"])
