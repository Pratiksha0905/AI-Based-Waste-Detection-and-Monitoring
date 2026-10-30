"""SQLite migration from filesystem-backed report images to database BLOBs."""

from __future__ import annotations

import logging
import mimetypes
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncConnection

logger = logging.getLogger(__name__)


async def migrate_legacy_report_images(
    connection: AsyncConnection, legacy_upload_path: Path
) -> None:
    """Add image columns and copy any still-available legacy files into SQLite."""
    await connection.run_sync(
        _migrate_legacy_report_images,
        legacy_upload_path,
    )


def _migrate_legacy_report_images(connection, legacy_upload_path: Path) -> None:
    columns = {column["name"] for column in inspect(connection).get_columns("reports")}
    added_image_data = "image_data" not in columns

    if added_image_data:
        connection.exec_driver_sql("ALTER TABLE reports ADD COLUMN image_data BLOB")
    if "image_media_type" not in columns:
        connection.exec_driver_sql(
            "ALTER TABLE reports ADD COLUMN image_media_type VARCHAR(32)"
        )

    if not added_image_data:
        return

    _copy_legacy_report_images(connection, legacy_upload_path)


def copy_legacy_report_images(connection, legacy_upload_path: Path) -> None:
    """Copy filesystem-backed images into an already-upgraded report table."""
    _copy_legacy_report_images(connection, legacy_upload_path)


def _copy_legacy_report_images(connection, legacy_upload_path: Path) -> None:
    root = legacy_upload_path.resolve()
    rows = connection.execute(
        text("SELECT id, image_key FROM reports WHERE image_data IS NULL")
    )
    for report_id, image_key in rows:
        image_path = (root / image_key).resolve()
        try:
            image_path.relative_to(root)
        except ValueError:
            logger.warning("Skipping legacy image with invalid path for report %s", report_id)
            continue

        if not image_path.is_file():
            logger.warning("Legacy image missing for report %s; image remains unavailable", report_id)
            continue

        media_type = mimetypes.guess_type(image_path.name)[0]
        if media_type not in {"image/jpeg", "image/png", "image/webp"}:
            logger.warning("Skipping legacy image with unsupported type for report %s", report_id)
            continue

        connection.execute(
            text(
                "UPDATE reports SET image_data = :image_data, "
                "image_media_type = :media_type WHERE id = :report_id"
            ),
            {
                "image_data": image_path.read_bytes(),
                "media_type": media_type,
                "report_id": report_id,
            },
        )
        logger.info("Migrated legacy image for report %s into SQLite", report_id)
