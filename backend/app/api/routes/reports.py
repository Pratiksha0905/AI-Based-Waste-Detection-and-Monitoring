"""EcoWatch AI — Report routes."""

from __future__ import annotations

import math
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, require_admin
from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.session import get_db
from app.models.user import User
from app.schemas.report import (
    PaginatedReports,
    ReportCreate,
    ReportOut,
    ReportSummary,
    ReviewStatusUpdate,
)
from app.services import report_service
from app.services.image_storage_service import get_image_path

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _to_summary(report) -> ReportSummary:
    return ReportSummary(
        id=report.id,
        user_id=report.user_id,
        latitude=report.latitude,
        longitude=report.longitude,
        description=report.description,
        submitted_at=report.submitted_at,
        processing_status=report.processing_status,  # type: ignore
        review_status=report.review_status,           # type: ignore
        detection_count=len(report.detections) if hasattr(report, "detections") else 0,
    )


# ── Submit a new report ───────────────────────────────────────────────────────

@router.post("", response_model=ReportOut, status_code=201)
async def submit_report(
    image: UploadFile = File(..., description="Waste image (JPEG, PNG, WebP, max 20 MB)"),
    latitude: float = Form(..., ge=-90, le=90),
    longitude: float = Form(..., ge=-180, le=180),
    description: Optional[str] = Form(None, max_length=1000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a waste image and select coordinates to create a report.
    Inference is triggered asynchronously — the response returns immediately
    with processing_status='pending'.
    """
    payload = ReportCreate(
        latitude=latitude,
        longitude=longitude,
        description=description,
    )
    report = await report_service.create_report(db, current_user, image, payload)
    return ReportOut.model_validate(report)


# ── Own reports ───────────────────────────────────────────────────────────────

@router.get("/my", response_model=PaginatedReports)
async def my_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the authenticated user's own reports, paginated."""
    items, total = await report_service.list_user_reports(db, current_user, page, page_size)
    total_pages = max(1, math.ceil(total / page_size))
    return PaginatedReports(
        items=[_to_summary(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


# ── Admin: all reports ─────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedReports, dependencies=[Depends(require_admin)])
async def list_all_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    processing_status: Optional[str] = Query(None),
    review_status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Admin only: list all reports with optional filters."""
    items, total = await report_service.list_all_reports(
        db, page, page_size, processing_status, review_status
    )
    total_pages = max(1, math.ceil(total / page_size))
    return PaginatedReports(
        items=[_to_summary(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


# ── Single report ─────────────────────────────────────────────────────────────

@router.get("/{report_id}", response_model=ReportOut)
async def get_report(
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return a single report with detections.
    Regular users can only retrieve their own reports (returns 404 for others).
    """
    report = await report_service.get_report_for_user(db, report_id, current_user)
    return ReportOut.model_validate(report)


# ── Admin: update review status ───────────────────────────────────────────────

@router.patch("/{report_id}/status", response_model=ReportOut, dependencies=[Depends(require_admin)])
async def update_status(
    report_id: str,
    body: ReviewStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Admin only: update the review_status of a report."""
    report = await report_service.update_review_status(db, report_id, body)
    return ReportOut.model_validate(report)


# ── Image retrieval ───────────────────────────────────────────────────────────

@router.get("/{report_id}/image")
async def get_image(
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Serve the original uploaded image.
    Access is controlled by the same ownership rules as /reports/{id}.
    """
    report = await report_service.get_report_for_user(db, report_id, current_user)
    try:
        path = get_image_path(report.image_key)
    except FileNotFoundError:
        raise NotFoundError("Image file")

    return FileResponse(
        path=str(path),
        media_type="image/jpeg",  # FileResponse will detect actual type
        filename=report.image_key,
    )


# ── Retry inference ───────────────────────────────────────────────────────────

@router.post("/{report_id}/retry", response_model=ReportOut)
async def retry(
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retry inference on a failed or pending report.
    Users can retry their own; admins can retry any.
    """
    report = await report_service.retry_inference(db, report_id, current_user)
    return ReportOut.model_validate(report)
