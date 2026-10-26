"""
EcoWatch AI — Image storage service.

Handles:
  - File content validation (not just MIME type)
  - Safe unique filename generation
  - Path-traversal prevention
  - Persistent storage to a configurable local directory
  - Cleanup of orphaned files on DB failure

For production, swap the _write and _delete implementations with
S3 / GCS calls without touching any other module.
"""

from __future__ import annotations

import hashlib
import io
import logging
import os
import uuid
from pathlib import Path
from typing import Set

from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError

from app.core.config import get_settings
from app.core.exceptions import InvalidImageError, StorageError

logger = logging.getLogger(__name__)

settings = get_settings()

ALLOWED_MIME_TYPES: Set[str] = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_PIL_FORMATS: Set[str] = {"JPEG", "PNG", "WEBP"}


def _ensure_upload_dir() -> Path:
    path = settings.upload_path
    path.mkdir(parents=True, exist_ok=True)
    return path


async def validate_and_store_image(upload: UploadFile) -> str:
    """
    Validate image content and persist it.

    :param upload: The FastAPI UploadFile from the multipart request.
    :returns: A relative storage key (e.g. "abc123.jpg") for use in the DB.
    :raises InvalidImageError: File is invalid, unsupported, or too large.
    :raises StorageError: Disk write failed.
    """
    # ── 1. Size check (early reject before reading body fully) ────────────────
    # FastAPI / Starlette buffers up to the configured limit; we still check.
    raw = await upload.read(settings.max_upload_size_bytes + 1)
    if len(raw) > settings.max_upload_size_bytes:
        raise InvalidImageError(
            f"File exceeds maximum allowed size of {settings.max_upload_size_mb} MB."
        )
    if len(raw) == 0:
        raise InvalidImageError("Uploaded file is empty.")

    # ── 2. Content-based format validation (ignore browser MIME type) ─────────
    try:
        img = Image.open(io.BytesIO(raw))
        img.verify()  # checks for truncated / corrupt files
    except (UnidentifiedImageError, Exception) as exc:
        raise InvalidImageError(
            f"File is not a valid image or is corrupt. ({type(exc).__name__})"
        ) from exc

    # Re-open after verify() (verify() leaves the file pointer unusable)
    img = Image.open(io.BytesIO(raw))
    if img.format not in ALLOWED_PIL_FORMATS:
        raise InvalidImageError(
            f"Unsupported image format '{img.format}'. "
            f"Accepted formats: JPEG, PNG, WebP."
        )

    # ── 3. Generate a safe, unique filename ───────────────────────────────────
    # Use UUID4 to prevent collisions and avoid exposing original filename.
    ext_map = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}
    ext = ext_map[img.format]
    filename = f"{uuid.uuid4().hex}.{ext}"

    # ── 4. Write to disk ──────────────────────────────────────────────────────
    upload_dir = _ensure_upload_dir()
    dest = upload_dir / filename

    # Safety: confirm resolved path is inside upload dir (path-traversal guard)
    try:
        dest.resolve().relative_to(upload_dir.resolve())
    except ValueError:
        raise StorageError("Invalid storage path detected.")

    try:
        dest.write_bytes(raw)
    except OSError as exc:
        logger.error("Failed to write image to disk: %s", exc)
        raise StorageError("Image could not be saved to disk.") from exc

    logger.info("Stored image: key=%s size=%d bytes", filename, len(raw))
    return filename


def delete_image(image_key: str) -> None:
    """
    Delete a stored image by its storage key.

    Silently ignores missing files (idempotent cleanup).
    Never raises — used in rollback paths.
    """
    if not image_key:
        return
    path = settings.upload_path / image_key
    try:
        path.unlink(missing_ok=True)
        logger.info("Deleted image: key=%s", image_key)
    except OSError as exc:
        logger.warning("Could not delete image key=%s: %s", image_key, exc)


def get_image_path(image_key: str) -> Path:
    """
    Return the absolute path for an image key.

    :raises FileNotFoundError: if the file does not exist on disk.
    """
    path = (settings.upload_path / image_key).resolve()
    # Path-traversal guard
    if not path.is_relative_to(settings.upload_path.resolve()):
        raise FileNotFoundError("Invalid image path.")
    if not path.exists():
        raise FileNotFoundError(f"Image not found on disk: {image_key}")
    return path
