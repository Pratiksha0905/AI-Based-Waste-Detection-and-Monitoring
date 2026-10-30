"""Validate uploaded image content before it is stored in the database."""

from __future__ import annotations

import io
import uuid
from dataclasses import dataclass
from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError

from app.core.config import get_settings
from app.core.exceptions import InvalidImageError

ALLOWED_PIL_FORMATS = {"JPEG", "PNG", "WEBP"}
MEDIA_TYPES = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}


@dataclass(frozen=True)
class ValidatedImage:
    key: str
    data: bytes
    media_type: str


async def validate_image_upload(upload: UploadFile) -> ValidatedImage:
    """
    Validate image content and prepare it for persistence.

    :param upload: The FastAPI UploadFile from the multipart request.
    :returns: Validated bytes, detected media type, and an opaque identifier.
    :raises InvalidImageError: File is invalid, unsupported, or too large.
    """
    settings = get_settings()
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
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
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

    # Use an opaque ID so the original filename is not exposed.
    return ValidatedImage(
        key=uuid.uuid4().hex,
        data=raw,
        media_type=MEDIA_TYPES[img.format],
    )
