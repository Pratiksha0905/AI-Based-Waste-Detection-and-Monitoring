"""Store report image bytes in the database."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

from app.core.config import get_settings
from app.db.image_migration import copy_legacy_report_images

revision = "20261030_database_image_storage"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("reports")}
    added_image_data = "image_data" not in columns

    if added_image_data:
        op.add_column("reports", sa.Column("image_data", sa.LargeBinary(), nullable=True))
    if "image_media_type" not in columns:
        op.add_column(
            "reports", sa.Column("image_media_type", sa.String(length=32), nullable=True)
        )

    if added_image_data:
        copy_legacy_report_images(bind, get_settings().legacy_upload_path)


def downgrade() -> None:
    raise RuntimeError(
        "Image storage migration is irreversible: downgrading would discard report image data."
    )
