"""add campaigns module

Revision ID: 5fe1e96a0788
Revises: 41b0e244297e
Create Date: 2026-08-19 21:47:03.661717

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5fe1e96a0788'
down_revision: Union[str, None] = '41b0e244297e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Brand-new enum types (not additions to an existing type), so they're
    # created outright rather than via ALTER TYPE ... ADD VALUE. Following
    # this repo's own initial-schema precedent (598450438270), each usage is
    # a fresh inline sa.Enum(...) rather than a shared pre-created instance
    # -- SQLAlchemy's create_table/add_column dispatch creates the
    # underlying Postgres type itself (checkfirst-safe), so a separate
    # explicit .create() call is unnecessary and causes a duplicate-type
    # error when combined with that automatic dispatch.
    campaign_status = sa.Enum(
        "draft", "scheduled", "live", "paused", "completed", name="campaign_status"
    )
    platform_enum = sa.Enum("instagram", "youtube", name="platform")

    op.create_table(
        "campaigns",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("campaign_code", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("status", campaign_status, nullable=False, server_default="draft"),
        sa.Column("target_videos", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("creators_needed", sa.Integer(), nullable=True),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("demographic", sa.Text(), nullable=True),
        sa.Column("language", sa.String(length=60), nullable=True),
        sa.Column("platforms", sa.JSON(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_campaigns_campaign_code"), "campaigns", ["campaign_code"], unique=True)
    op.create_index(op.f("ix_campaigns_created_by"), "campaigns", ["created_by"], unique=False)

    op.create_table(
        "campaign_products",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("campaign_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("target_videos", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("campaign_id", "product_id", name="uq_campaign_product"),
    )
    op.create_index(op.f("ix_campaign_products_campaign_id"), "campaign_products", ["campaign_id"], unique=False)
    op.create_index(op.f("ix_campaign_products_product_id"), "campaign_products", ["product_id"], unique=False)

    op.create_table(
        "campaign_participants",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("campaign_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("allocation", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_mandatory", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("campaign_id", "user_id", name="uq_campaign_participant"),
    )
    op.create_index(
        op.f("ix_campaign_participants_campaign_id"), "campaign_participants", ["campaign_id"], unique=False
    )
    op.create_index(op.f("ix_campaign_participants_user_id"), "campaign_participants", ["user_id"], unique=False)

    # Additive columns on the pre-existing, live `collaborations` table.
    # Both nullable with no backfill -- existing rows simply get NULL.
    # Unlike create_table (which auto-creates a referenced enum type as part
    # of its own DDL dispatch, as `campaign_status` did above), add_column
    # does NOT auto-create the type -- it assumes it already exists. `platform`
    # isn't used anywhere else in this migration, so it needs an explicit create.
    platform_enum.create(op.get_bind())
    op.add_column("collaborations", sa.Column("campaign_id", sa.Integer(), nullable=True))
    op.add_column("collaborations", sa.Column("platform", platform_enum, nullable=True))
    op.create_index(op.f("ix_collaborations_campaign_id"), "collaborations", ["campaign_id"], unique=False)
    # Base has no naming_convention configured (app/db/base.py), so an FK
    # added via add_column+create_foreign_key against an already-existing
    # table needs an explicit name in both directions -- same gotcha fixed
    # in the previous migration (41b0e244297e's supervisor_id FK).
    op.create_foreign_key(
        "fk_collaborations_campaign_id_campaigns",
        "collaborations", "campaigns", ["campaign_id"], ["id"], ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_collaborations_campaign_id_campaigns", "collaborations", type_="foreignkey")
    op.drop_index(op.f("ix_collaborations_campaign_id"), table_name="collaborations")
    op.drop_column("collaborations", "platform")
    op.drop_column("collaborations", "campaign_id")

    op.drop_table("campaign_participants")
    op.drop_table("campaign_products")
    op.drop_table("campaigns")

    # Safe to genuinely DROP these types (unlike ALTER TYPE ADD VALUE on an
    # existing type): they're brand new from this migration, so nothing else
    # can reference them once the columns/tables above are gone.
    sa.Enum(name="platform").drop(op.get_bind())
    sa.Enum(name="campaign_status").drop(op.get_bind())
