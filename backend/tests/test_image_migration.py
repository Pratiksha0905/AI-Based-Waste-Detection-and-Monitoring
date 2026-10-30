"""Tests for migrating existing report images into SQLite."""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.image_migration import migrate_legacy_report_images

pytestmark = pytest.mark.asyncio


async def test_migrates_existing_image_file_into_database(tmp_path, minimal_jpeg: bytes):
    legacy_dir = tmp_path / "legacy"
    legacy_dir.mkdir()
    image_path = legacy_dir / "legacy-report.jpg"
    image_path.write_bytes(minimal_jpeg)

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    try:
        async with engine.begin() as connection:
            await connection.execute(
                text(
                    "CREATE TABLE reports ("
                    "id TEXT PRIMARY KEY, image_key TEXT NOT NULL)"
                )
            )
            await connection.execute(
                text("INSERT INTO reports (id, image_key) VALUES ('report-1', 'legacy-report.jpg')")
            )

            await migrate_legacy_report_images(connection, legacy_dir)

            result = await connection.execute(
                text(
                    "SELECT image_data, image_media_type FROM reports "
                    "WHERE id = 'report-1'"
                )
            )
            image_data, media_type = result.one()
            assert image_data == minimal_jpeg
            assert media_type == "image/jpeg"
    finally:
        await engine.dispose()
