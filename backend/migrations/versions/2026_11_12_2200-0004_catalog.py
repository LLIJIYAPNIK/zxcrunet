"""catalog: titles, shelf entries and posts

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-12 22:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "catalog_titles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("year_end", sa.Integer(), nullable=True),
        sa.Column("creator", sa.String(length=80), nullable=False),
        sa.Column("genres", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("description", sa.String(length=1200), nullable=False),
        sa.Column("cover", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_series", sa.Boolean(), nullable=False),
        sa.Column("series_id", sa.Uuid(), nullable=True),
        sa.Column("part_label", sa.String(length=24), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=16), nullable=False),
        sa.Column("external_id", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            name=op.f("fk_catalog_titles_owner_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["series_id"],
            ["catalog_titles.id"],
            name=op.f("fk_catalog_titles_series_id_catalog_titles"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_catalog_titles")),
        sa.UniqueConstraint("owner_id", "kind", "slug", name=op.f("uq_catalog_titles_owner_id")),
    )
    op.create_index(
        op.f("ix_catalog_titles_owner_id"), "catalog_titles", ["owner_id"], unique=False
    )
    op.create_index(
        op.f("ix_catalog_titles_series_id"), "catalog_titles", ["series_id"], unique=False
    )

    op.create_table(
        "shelf_entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("title_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("hours", sa.Integer(), nullable=True),
        sa.Column("progress", sa.Integer(), nullable=True),
        sa.Column("progress_total", sa.Integer(), nullable=True),
        sa.Column("favorite", sa.Boolean(), nullable=False),
        sa.Column("started_on", sa.Date(), nullable=True),
        sa.Column("finished_on", sa.Date(), nullable=True),
        sa.Column("notes", sa.String(length=2000), nullable=False),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            name=op.f("fk_shelf_entries_owner_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["title_id"],
            ["catalog_titles.id"],
            name=op.f("fk_shelf_entries_title_id_catalog_titles"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_shelf_entries")),
        sa.UniqueConstraint("owner_id", "title_id", name=op.f("uq_shelf_entries_owner_id")),
    )
    op.create_index(op.f("ix_shelf_entries_owner_id"), "shelf_entries", ["owner_id"], unique=False)
    op.create_index(op.f("ix_shelf_entries_title_id"), "shelf_entries", ["title_id"], unique=False)

    op.create_table(
        "catalog_posts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("heading", sa.String(length=160), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("title_id", sa.Uuid(), nullable=True),
        sa.Column("published_on", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            name=op.f("fk_catalog_posts_owner_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["title_id"],
            ["catalog_titles.id"],
            name=op.f("fk_catalog_posts_title_id_catalog_titles"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_catalog_posts")),
    )
    op.create_index(op.f("ix_catalog_posts_owner_id"), "catalog_posts", ["owner_id"], unique=False)
    op.create_index(op.f("ix_catalog_posts_title_id"), "catalog_posts", ["title_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_catalog_posts_title_id"), table_name="catalog_posts")
    op.drop_index(op.f("ix_catalog_posts_owner_id"), table_name="catalog_posts")
    op.drop_table("catalog_posts")
    op.drop_index(op.f("ix_shelf_entries_title_id"), table_name="shelf_entries")
    op.drop_index(op.f("ix_shelf_entries_owner_id"), table_name="shelf_entries")
    op.drop_table("shelf_entries")
    op.drop_index(op.f("ix_catalog_titles_series_id"), table_name="catalog_titles")
    op.drop_index(op.f("ix_catalog_titles_owner_id"), table_name="catalog_titles")
    op.drop_table("catalog_titles")
