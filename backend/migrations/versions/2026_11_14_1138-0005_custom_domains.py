"""custom domains: ownership proof over DNS, statuses and the check schedule

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-14 11:38:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "custom_domains",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("site_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("host", sa.String(length=253), nullable=False),
        sa.Column("verification_token", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("checks_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("failures", sa.Integer(), nullable=False),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("problems", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("next_check_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            name=op.f("fk_custom_domains_owner_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["site_id"],
            ["sites.id"],
            name=op.f("fk_custom_domains_site_id_sites"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_custom_domains")),
        sa.UniqueConstraint("owner_id", "host", name="uq_custom_domains_owner_host"),
    )
    op.create_index(
        "ix_custom_domains_next_check_at", "custom_domains", ["next_check_at"], unique=False
    )
    op.create_index(op.f("ix_custom_domains_site_id"), "custom_domains", ["site_id"], unique=False)
    op.create_index(
        "uq_custom_domains_serving_host",
        "custom_domains",
        ["host"],
        unique=True,
        postgresql_where=sa.text("status IN ('verified', 'active')"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_custom_domains_serving_host",
        table_name="custom_domains",
        postgresql_where=sa.text("status IN ('verified', 'active')"),
    )
    op.drop_index(op.f("ix_custom_domains_site_id"), table_name="custom_domains")
    op.drop_index("ix_custom_domains_next_check_at", table_name="custom_domains")
    op.drop_table("custom_domains")
