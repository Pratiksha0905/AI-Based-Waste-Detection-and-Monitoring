"""
EcoWatch AI — Custom exception classes and FastAPI exception handlers.

All handlers return a consistent JSON error envelope:
  {
    "detail": "<human-readable message>",
    "code": "<machine-readable error code>"   # optional
  }
"""

from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


# ── Domain exceptions ─────────────────────────────────────────────────────────

class EcoWatchError(Exception):
    """Base class for all application-level errors."""


class NotFoundError(EcoWatchError):
    """Resource does not exist or the caller has no permission to see it."""

    def __init__(self, resource: str = "Resource") -> None:
        super().__init__(f"{resource} not found.")
        self.resource = resource


class ForbiddenError(EcoWatchError):
    """Authenticated but not permitted to perform this action."""


class ConflictError(EcoWatchError):
    """Request conflicts with existing state (e.g. duplicate email)."""


class InvalidImageError(EcoWatchError):
    """Uploaded file is not a valid, supported image."""


class StorageError(EcoWatchError):
    """File could not be persisted to storage."""


class ModelUnavailableError(EcoWatchError):
    """Model checkpoint is not configured or cannot be loaded."""


# ── FastAPI exception handlers ────────────────────────────────────────────────

def _err(message: str, code: str | None = None) -> dict:
    payload: dict = {"detail": message}
    if code:
        payload["code"] = code
    return payload


def register_exception_handlers(app: FastAPI) -> None:
    """Attach domain-exception handlers to *app*."""

    @app.exception_handler(NotFoundError)
    async def _not_found(_: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=_err(str(exc), "not_found"),
        )

    @app.exception_handler(ForbiddenError)
    async def _forbidden(_: Request, exc: ForbiddenError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content=_err(str(exc) or "Access forbidden.", "forbidden"),
        )

    @app.exception_handler(ConflictError)
    async def _conflict(_: Request, exc: ConflictError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=_err(str(exc), "conflict"),
        )

    @app.exception_handler(InvalidImageError)
    async def _invalid_image(_: Request, exc: InvalidImageError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_err(str(exc), "invalid_image"),
        )

    @app.exception_handler(StorageError)
    async def _storage(_: Request, exc: StorageError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_err("Image could not be stored. Please try again.", "storage_error"),
        )

    @app.exception_handler(ModelUnavailableError)
    async def _model(_: Request, exc: ModelUnavailableError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=_err(str(exc), "model_unavailable"),
        )
