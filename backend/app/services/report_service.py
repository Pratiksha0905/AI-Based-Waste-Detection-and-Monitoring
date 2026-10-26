"""
EcoWatch AI — Report service.

Business logic for:
  - Creating reports (image upload → DB save → async inference)
  - Querying reports (owner-checked or admin-unrestricted)
  - Status updates
  - Retry of failed inference
"""

from __future__ import annotations

import asyncio
import logging
from typing import List, Optional, Tuple

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ForbiddenError, ModelUnavailableError, NotFoundError
from app.models.report import Detection, Report
from app.models.user import User
from app.schemas.report import ReportCreate, ReviewStatusUpdate
from app.services.image_storage_service import delete_image, validate_and_store_image
from app.services.model_service import model_service

logger = logging.getLogger(__name__)


# ── Create ────────────────────────────────────────────────────────────────────

async def create_report(
    db: AsyncSession,
    user: User,
    upload,         # FastAPI UploadFile
    payload: ReportCreate,
) -> Report:
    """
    Full report creation workflow:
      1. Validate & persist image.
      2. Save Report row (processing_status='pending').
      3. Commit.
      4. Kick off inference in background (non-blocking).
    """
    from app.services.image_storage_service import validate_and_store_image

    # Step 1 — image validation and storage
    image_key = await validate_and_store_image(upload)

    # Step 2 — create DB row
    report = Report(
        user_id=user.id,
        image_key=image_key,
        latitude=payload.latitude,
        longitude=payload.longitude,
        description=payload.description,
        processing_status="pending",
        review_status="pending_review",
    )
    db.add(report)

    try:
        await db.commit()
        await db.refresh(report)
    except Exception as exc:
        await db.rollback()
        # Clean up orphaned image file
        delete_image(image_key)
        logger.error("DB commit failed for new report: %s", exc)
        raise

    # Step 3 — background inference (fire-and-forget)
    asyncio.create_task(_run_inference(report.id, image_key))

    return report


async def _run_inference(report_id: str, image_key: str) -> None:
    """
    Run model inference in a background task.

    Updates processing_status in the DB.
    On failure, records the error and sets status='failed'.
    The report and image are always preserved.
    """
    from app.db.session import AsyncSessionLocal
    from app.services.image_storage_service import get_image_path

    async with AsyncSessionLocal() as db:
        try:
            # Mark as processing
            await db.execute(
                update(Report)
                .where(Report.id == report_id)
                .values(processing_status="processing")
            )
            await db.commit()

            # Read image bytes
            img_path = get_image_path(image_key)
            raw = img_path.read_bytes()

            # Run inference (sync — model_service.run_inference is synchronous)
            result = await asyncio.get_event_loop().run_in_executor(
                None, model_service.run_inference, raw
            )

            # Persist detections
            detections = [
                Detection(
                    report_id=report_id,
                    predicted_class=d.predicted_class,
                    confidence=d.confidence,
                    bbox_x1=d.bbox_x1,
                    bbox_y1=d.bbox_y1,
                    bbox_x2=d.bbox_x2,
                    bbox_y2=d.bbox_y2,
                    model_version=result.model_version,
                )
                for d in result.detections
            ]
            db.add_all(detections)

            await db.execute(
                update(Report)
                .where(Report.id == report_id)
                .values(processing_status="completed", processing_error=None)
            )
            await db.commit()
            logger.info(
                "Inference complete for report %s: %d detections",
                report_id,
                len(detections),
            )

        except ModelUnavailableError as exc:
            await db.rollback()
            await db.execute(
                update(Report)
                .where(Report.id == report_id)
                .values(
                    processing_status="pending",
                    processing_error=str(exc),
                )
            )
            await db.commit()
            logger.info("Model unavailable for report %s — marked pending.", report_id)

        except Exception as exc:
            await db.rollback()
            await db.execute(
                update(Report)
                .where(Report.id == report_id)
                .values(
                    processing_status="failed",
                    processing_error=str(exc),
                )
            )
            await db.commit()
            logger.error("Inference failed for report %s: %s", report_id, exc)


# ── Queries ───────────────────────────────────────────────────────────────────

async def get_report_for_user(
    db: AsyncSession, report_id: str, user: User
) -> Report:
    """
    Return a single report.

    - Admin users can access any report.
    - Regular users can only access their own.
    Raises NotFoundError (not ForbiddenError) to avoid information leakage.
    """
    result = await db.execute(
        select(Report)
        .options(selectinload(Report.detections))
        .where(Report.id == report_id)
    )
    report = result.scalar_one_or_none()

    if report is None:
        raise NotFoundError("Report")

    if user.role != "admin" and report.user_id != user.id:
        # Return 404, not 403, to prevent ID enumeration
        raise NotFoundError("Report")

    return report


async def list_user_reports(
    db: AsyncSession,
    user: User,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[Report], int]:
    """List reports belonging to the authenticated user, paginated."""
    offset = (page - 1) * page_size

    count_result = await db.execute(
        select(func.count()).select_from(Report).where(Report.user_id == user.id)
    )
    total = count_result.scalar_one()

    rows = await db.execute(
        select(Report)
        .where(Report.user_id == user.id)
        .order_by(Report.submitted_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    return rows.scalars().all(), total


async def list_all_reports(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    processing_status: Optional[str] = None,
    review_status: Optional[str] = None,
) -> Tuple[List[Report], int]:
    """Admin-only: list all reports with optional filters, paginated."""
    offset = (page - 1) * page_size

    q = select(Report)
    count_q = select(func.count()).select_from(Report)

    if processing_status:
        q = q.where(Report.processing_status == processing_status)
        count_q = count_q.where(Report.processing_status == processing_status)
    if review_status:
        q = q.where(Report.review_status == review_status)
        count_q = count_q.where(Report.review_status == review_status)

    total = (await db.execute(count_q)).scalar_one()
    rows = await db.execute(q.order_by(Report.submitted_at.desc()).offset(offset).limit(page_size))
    return rows.scalars().all(), total


async def update_review_status(
    db: AsyncSession, report_id: str, update_in: ReviewStatusUpdate
) -> Report:
    """Admin-only: update the review_status of a report."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if report is None:
        raise NotFoundError("Report")

    report.review_status = update_in.review_status
    await db.commit()
    await db.refresh(report)
    return report


async def retry_inference(db: AsyncSession, report_id: str, user: User) -> Report:
    """
    Retry inference on a failed report.

    Regular users can retry their own failed reports.
    Admins can retry any report.
    """
    report = await get_report_for_user(db, report_id, user)

    if report.processing_status not in ("failed", "pending"):
        raise ForbiddenError(
            f"Cannot retry a report with status '{report.processing_status}'."
        )

    report.processing_status = "pending"
    report.processing_error = None
    report.retry_count += 1
    await db.commit()
    await db.refresh(report)

    asyncio.create_task(_run_inference(report_id, report.image_key))
    return report
