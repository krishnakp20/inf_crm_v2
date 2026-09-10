"""add collaboration_video_links

Revision ID: 37ce97b3ef09
Revises: 95f40b44c0a1
Create Date: 2026-09-10 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '37ce97b3ef09'
down_revision: Union[str, None] = '95f40b44c0a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Additional (platform, link) pairs beyond the first -- a collaboration
    # can go live on more than one platform. The first pair keeps using the
    # existing collaborations.video_link/.platform columns unchanged; this
    # table holds the 2nd, 3rd, ... entries. `platform` reuses the existing
    # `platform` enum type (created by the initial migration) -- create_type=False
    # so it isn't re-created.
    platform_enum = postgresql.ENUM("instagram", "youtube", name="platform", create_type=False)
    op.create_table(
        "collaboration_video_links",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("collaboration_id", sa.Integer(), nullable=False),
        sa.Column("platform", platform_enum, nullable=False),
        sa.Column("url", sa.String(length=300), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["collaboration_id"], ["collaborations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_collaboration_video_links_collaboration_id"),
        "collaboration_video_links",
        ["collaboration_id"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_collaboration_video_links_collaboration_id"), table_name="collaboration_video_links"
    )
    op.drop_table("collaboration_video_links")
