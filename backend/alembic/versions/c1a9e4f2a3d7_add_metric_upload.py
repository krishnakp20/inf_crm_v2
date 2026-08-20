"""add metric upload

Revision ID: c1a9e4f2a3d7
Revises: b64d7f8b3b91
Create Date: 2026-08-20 07:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1a9e4f2a3d7'
down_revision: Union[str, None] = 'b64d7f8b3b91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # metric_import_status is used only inside create_table below (never in a
    # bare add_column), so create_table's own DDL dispatch auto-creates the
    # underlying Postgres type -- no separate explicit .create() call (the
    # enum-double-creation gotcha documented in b64d7f8b3b91).
    metric_import_status = sa.Enum("completed", "failed", name="metric_import_status")

    op.create_table(
        "metric_imports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", metric_import_status, nullable=False, server_default="completed"),
        sa.Column("uploaded_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_metric_imports_uploaded_by"), "metric_imports", ["uploaded_by"], unique=False)
    op.create_index(op.f("ix_metric_imports_created_at"), "metric_imports", ["created_at"], unique=False)

    # Additive nullable columns -- populated only by Metric Upload.
    op.add_column("collaborations", sa.Column("likes_count", sa.Integer(), nullable=True))
    op.add_column("collaborations", sa.Column("revenue", sa.Numeric(10, 2), nullable=True))
    op.add_column("collaborations", sa.Column("ad_spend", sa.Numeric(10, 2), nullable=True))
    op.add_column("collaborations", sa.Column("roas", sa.Numeric(6, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("collaborations", "roas")
    op.drop_column("collaborations", "ad_spend")
    op.drop_column("collaborations", "revenue")
    op.drop_column("collaborations", "likes_count")
    op.drop_table("metric_imports")
    sa.Enum(name="metric_import_status").drop(op.get_bind())
