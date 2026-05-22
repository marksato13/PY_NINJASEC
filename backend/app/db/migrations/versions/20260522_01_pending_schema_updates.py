"""Pending schema updates from implementation docs.

Revision ID: 20260522_01
Revises: 
Create Date: 2026-05-22
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260522_01"
down_revision = None
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def upgrade() -> None:
    # clients.city / clients.country
    if not _has_column("clients", "city"):
        op.add_column("clients", sa.Column("city", sa.String(length=120), nullable=True))
    if not _has_column("clients", "country"):
        op.add_column("clients", sa.Column("country", sa.String(length=80), nullable=True))

    # collaborator_profiles.area / collaborator_profiles.photo_url
    if not _has_column("collaborator_profiles", "area"):
        op.add_column("collaborator_profiles", sa.Column("area", sa.String(length=60), nullable=True))
    if not _has_column("collaborator_profiles", "photo_url"):
        op.add_column("collaborator_profiles", sa.Column("photo_url", sa.String(length=500), nullable=True))

    # services.price_label
    if not _has_column("services", "price_label"):
        op.add_column("services", sa.Column("price_label", sa.String(length=80), nullable=True))

    # projects.budget_label
    if not _has_column("projects", "budget_label"):
        op.add_column("projects", sa.Column("budget_label", sa.String(length=80), nullable=True))

    # devices.integration_id nullable (inventario base sin integración)
    op.alter_column("devices", "integration_id", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    # Reverse nullable change (only safe when no NULL data exists)
    op.alter_column("devices", "integration_id", existing_type=sa.Integer(), nullable=False)

    if _has_column("projects", "budget_label"):
        op.drop_column("projects", "budget_label")

    if _has_column("services", "price_label"):
        op.drop_column("services", "price_label")

    if _has_column("collaborator_profiles", "photo_url"):
        op.drop_column("collaborator_profiles", "photo_url")
    if _has_column("collaborator_profiles", "area"):
        op.drop_column("collaborator_profiles", "area")

    if _has_column("clients", "country"):
        op.drop_column("clients", "country")
    if _has_column("clients", "city"):
        op.drop_column("clients", "city")
