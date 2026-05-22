"""devices ISO P1 + connections

Revision ID: e1d861bf2ce6
Revises: 20260522_01
Create Date: 2026-05-22 16:52:16.962048

Cambios formalizados:
- devices.criticality (ISO 27001 A.8.1.2)
- devices.data_classification (ISO 27001 A.8.2)
- devices.responsible_user_id (NIST CSF ID.AM-6, FK a users)
- Tabla device_connections (topología de red)
"""

from alembic import op
import sqlalchemy as sa


revision = "e1d861bf2ce6"
down_revision = "20260522_01"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def _has_table(table_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    # devices — campos ISO 27001 A.8 / NIST CSF ID.AM (P1)
    if not _has_column("devices", "criticality"):
        op.add_column("devices", sa.Column("criticality", sa.String(length=20), nullable=True))
    if not _has_column("devices", "data_classification"):
        op.add_column("devices", sa.Column("data_classification", sa.String(length=20), nullable=True))
    if not _has_column("devices", "responsible_user_id"):
        op.add_column(
            "devices",
            sa.Column("responsible_user_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            "devices_responsible_user_id_fkey",
            "devices",
            "users",
            ["responsible_user_id"],
            ["id"],
        )

    # device_connections — topología
    if not _has_table("device_connections"):
        op.create_table(
            "device_connections",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("source_device_id", sa.Integer(), nullable=False),
            sa.Column("target_device_id", sa.Integer(), nullable=False),
            sa.Column("link_type", sa.String(length=30), nullable=False, server_default="ethernet"),
            sa.Column("port_source", sa.String(length=40), nullable=True),
            sa.Column("port_target", sa.String(length=40), nullable=True),
            sa.Column("vlan_id", sa.Integer(), nullable=True),
            sa.Column("bandwidth_mbps", sa.Integer(), nullable=True),
            sa.Column("notes", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
            sa.ForeignKeyConstraint(
                ["source_device_id"], ["devices.id"], ondelete="CASCADE",
                name="fk_device_connections_source_device_id_devices",
            ),
            sa.ForeignKeyConstraint(
                ["target_device_id"], ["devices.id"], ondelete="CASCADE",
                name="fk_device_connections_target_device_id_devices",
            ),
            sa.UniqueConstraint(
                "source_device_id", "target_device_id", "link_type",
                name="uq_device_connection_triplet",
            ),
        )


def downgrade() -> None:
    if _has_table("device_connections"):
        op.drop_table("device_connections")

    if _has_column("devices", "responsible_user_id"):
        op.drop_constraint("devices_responsible_user_id_fkey", "devices", type_="foreignkey")
        op.drop_column("devices", "responsible_user_id")
    if _has_column("devices", "data_classification"):
        op.drop_column("devices", "data_classification")
    if _has_column("devices", "criticality"):
        op.drop_column("devices", "criticality")
