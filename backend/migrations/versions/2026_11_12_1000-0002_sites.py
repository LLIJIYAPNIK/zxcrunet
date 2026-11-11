"""sites, pages and reserved slugs

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-12 10:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SYSTEM = "служебный адрес zxcrunet"
MAIL = "почтовый или DNS-адрес"
RESERVED = {
    **dict.fromkeys(
        [
            "www", "api", "app", "admin", "static", "media", "assets", "cdn", "img",
            "zxc", "zxcrunet", "support", "help", "status", "docs", "blog", "auth",
            "login", "register", "account", "dashboard", "panel", "internal", "tenant",
            "dev", "test", "staging", "demo", "billing", "pay", "security", "abuse",
            "legal", "about", "root", "system",
        ],
        SYSTEM,
    ),
    **dict.fromkeys(
        ["mail", "smtp", "imap", "pop", "mx", "ns1", "ns2", "ftp", "postmaster",
         "hostmaster", "webmaster", "noreply", "no-reply"],
        MAIL,
    ),
}  # fmt: skip


def upgrade() -> None:
    op.create_table(
        "sites",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("slug", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("theme_accent", sa.String(length=7), nullable=False),
        sa.Column("theme_second", sa.String(length=7), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("seo_title", sa.String(length=70), nullable=False),
        sa.Column("seo_description", sa.String(length=200), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("published_revision", sa.Integer(), nullable=True),
        sa.Column("published", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], name=op.f("fk_sites_owner_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sites")),
        sa.UniqueConstraint("slug", name=op.f("uq_sites_slug")),
    )
    op.create_index(op.f("ix_sites_owner_id"), "sites", ["owner_id"], unique=False)

    op.create_table(
        "site_pages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("site_id", sa.Uuid(), nullable=False),
        sa.Column("path", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("blocks", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(
            ["site_id"], ["sites.id"], name=op.f("fk_site_pages_site_id_sites"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_site_pages")),
        sa.UniqueConstraint("site_id", "path", name=op.f("uq_site_pages_site_id")),
    )
    op.create_index(op.f("ix_site_pages_site_id"), "site_pages", ["site_id"], unique=False)

    reserved = op.create_table(
        "reserved_slugs",
        sa.Column("slug", sa.String(length=32), nullable=False),
        sa.Column("reason", sa.String(length=120), nullable=False),
        sa.PrimaryKeyConstraint("slug", name=op.f("pk_reserved_slugs")),
    )
    op.bulk_insert(reserved, [{"slug": s, "reason": r} for s, r in sorted(RESERVED.items())])


def downgrade() -> None:
    op.drop_table("reserved_slugs")
    op.drop_index(op.f("ix_site_pages_site_id"), table_name="site_pages")
    op.drop_table("site_pages")
    op.drop_index(op.f("ix_sites_owner_id"), table_name="sites")
    op.drop_table("sites")
