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
from typing import Callable, List, Optional, Tuple

from fastapi import BackgroundTasks

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ForbiddenError, ModelUnavailableError, NotFoundError
from app.models.report import Detection, Report
from app.models.user import User
from app.schemas.report import ReportCreate, ReviewStatusUpdate
from app.services.image_storage_service import validate_image_upload
from app.services.model_service import model_service

logger = logging.getLogger(__name__)


# ── Create ────────────────────────────────────────────────────────────────────

async def create_report(
    db: AsyncSession,
    user: User,
    upload,                         # FastAPI UploadFile
    payload: ReportCreate,
    background_tasks: Optional[BackgroundTasks] = None,
) -> Report:
    """
    Full report creation workflow:
      1. Validate & persist image.
      2. Save Report row (processing_status='pending').
      3. Commit.
      4. Schedule inference via FastAPI BackgroundTasks (bound to request lifecycle).
    """
    # Step 1 — validate the upload before saving its bytes in the report row.
    image = await validate_image_upload(upload)

    # Step 2 — create DB row
    report = Report(
        user_id=user.id,
        image_key=image.key,
        image_data=image.data,
        image_media_type=image.media_type,
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
        logger.error("DB commit failed for new report: %s", exc)
        raise

    # Eagerly load detections so Pydantic model_validate doesn't lazy-load
    result = await db.execute(
        select(Report)
        .options(selectinload(Report.detections))
        .where(Report.id == report.id)
    )
    report = result.scalar_one()

    # Step 3 — schedule background inference
    if background_tasks is not None:
        background_tasks.add_task(_run_inference_sync, report.id)
    else:
        # Fallback for direct service calls (tests, CLI)
        asyncio.ensure_future(_run_inference(report.id))

    return report


def _run_inference_sync(report_id: str) -> None:
    """
    Synchronous wrapper used by FastAPI BackgroundTasks.
    Runs the async inference coroutine in a new event loop.
    """
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_run_inference(report_id))
    finally:
        loop.close()


async def _run_inference(report_id: str) -> None:
    """
    Run model inference in a background task.

    Updates processing_status in the DB.
    On failure, records the error and sets status='failed'.
    The report and image are always preserved.
    """
    from app.db.session import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        try:
            # Mark as processing
            await db.execute(
                update(Report)
                .where(Report.id == report_id)
                .values(processing_status="processing")
            )
            await db.commit()

            # Fetch the deferred BLOB only for inference; list queries avoid loading it.
            raw = (
                await db.execute(select(Report.image_data).where(Report.id == report_id))
            ).scalar_one_or_none()
            if raw is None:
                raise NotFoundError("Report image")

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

    # Re-fetch with eager detections for Pydantic serialization
    result = await db.execute(
        select(Report)
        .options(selectinload(Report.detections))
        .where(Report.id == report_id)
    )
    return result.scalar_one()


async def retry_inference(
    db: AsyncSession,
    report_id: str,
    user: User,
    background_tasks: Optional[BackgroundTasks] = None,
) -> Report:
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

    # Re-fetch with eager detections for Pydantic serialization
    refreshed = await db.execute(
        select(Report)
        .options(selectinload(Report.detections))
        .where(Report.id == report_id)
    )
    report = refreshed.scalar_one()

    if background_tasks is not None:
        background_tasks.add_task(_run_inference_sync, report_id)
    else:
        asyncio.ensure_future(_run_inference(report_id))

    return report
