"""plans and users

Revision ID: 0001
Revises:
Create Date: 2026-11-11 21:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    plans = op.create_table(
        "plans",
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=64), nullable=False),
        sa.Column("max_sites", sa.Integer(), nullable=False),
        sa.Column("max_custom_domains", sa.Integer(), nullable=False),
        sa.Column("max_upload_mb", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("code", name=op.f("pk_plans")),
    )
    op.bulk_insert(
        plans,
        [
            {
                "code": "free",
                "title": "Бесплатный",
                "max_sites": 3,
                "max_custom_domains": 3,
                "max_upload_mb": 10,
            }
        ],
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("plan_code", sa.String(length=32), nullable=False),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["plan_code"], ["plans.code"], name=op.f("fk_users_plan_code_plans")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )


def downgrade() -> None:
    op.drop_table("users")
    op.drop_table("plans")
