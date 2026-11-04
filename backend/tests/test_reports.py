"""EcoWatch AI — Report upload, persistence, and RBAC tests."""

from __future__ import annotations

import io
from pathlib import Path
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.asyncio


async def _submit_report(
    client: AsyncClient,
    token: str,
    image_bytes: bytes,
    lat: float = 12.9716,
    lng: float = 77.5946,
) -> dict:
    r = await client.post(
        "/api/reports",
        headers={"Authorization": f"Bearer {token}"},
        files={"image": ("test.jpg", io.BytesIO(image_bytes), "image/jpeg")},
        data={"latitude": str(lat), "longitude": str(lng), "description": "Test report"},
    )
    return r


class TestReportSubmission:
    async def test_submit_valid_report(
        self, client: AsyncClient, user_token: str, minimal_jpeg: bytes
    ):
        r = await _submit_report(client, user_token, minimal_jpeg)
        assert r.status_code == 201
        data = r.json()
        assert data["processing_status"] == "pending"
        assert data["latitude"] == 12.9716
        assert data["longitude"] == 77.5946
        assert "id" in data

    async def test_submit_requires_auth(self, client: AsyncClient, minimal_jpeg: bytes):
        r = await client.post(
            "/api/reports",
            files={"image": ("test.jpg", io.BytesIO(minimal_jpeg), "image/jpeg")},
            data={"latitude": "12.9716", "longitude": "77.5946"},
        )
        assert r.status_code == 401

    async def test_submit_invalid_image(self, client: AsyncClient, user_token: str):
        r = await client.post(
            "/api/reports",
            headers={"Authorization": f"Bearer {user_token}"},
            files={"image": ("not_an_image.jpg", io.BytesIO(b"this is not an image"), "image/jpeg")},
            data={"latitude": "12.9716", "longitude": "77.5946"},
        )
        assert r.status_code == 422

    async def test_submit_invalid_latitude(self, client: AsyncClient, user_token: str, minimal_jpeg: bytes):
        r = await _submit_report(client, user_token, minimal_jpeg, lat=999.0)
        assert r.status_code == 422

    async def test_submit_invalid_longitude(self, client: AsyncClient, user_token: str, minimal_jpeg: bytes):
        r = await _submit_report(client, user_token, minimal_jpeg, lng=999.0)
        assert r.status_code == 422

    async def test_report_persisted_in_db(
        self, client: AsyncClient, user_token: str, minimal_jpeg: bytes, db: AsyncSession
    ):
        r = await _submit_report(client, user_token, minimal_jpeg)
        assert r.status_code == 201
        report_id = r.json()["id"]

        # Verify DB record exists
        from sqlalchemy import select
        from app.models.report import Report

        result = await db.execute(
            select(
                Report.latitude,
                Report.longitude,
                Report.image_data,
                Report.image_media_type,
            ).where(Report.id == report_id)
        )
        latitude, longitude, image_data, image_media_type = result.one()
        assert latitude == 12.9716
        assert longitude == 77.5946
        assert image_data == minimal_jpeg
        assert image_media_type == "image/jpeg"


class TestReportAccess:
    async def test_user_can_get_own_report(
        self, client: AsyncClient, user_token: str, minimal_jpeg: bytes
    ):
        create_r = await _submit_report(client, user_token, minimal_jpeg)
        report_id = create_r.json()["id"]

        r = await client.get(
            f"/api/reports/{report_id}",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert r.status_code == 200

    async def test_user_cannot_get_other_users_report(
        self, client: AsyncClient, user_token: str, admin_token: str, minimal_jpeg: bytes
    ):
        # Admin submits a report
        create_r = await _submit_report(client, admin_token, minimal_jpeg)
        report_id = create_r.json()["id"]

        # Regular user should receive 404 (not 403 — no ID enumeration)
        r = await client.get(
            f"/api/reports/{report_id}",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert r.status_code == 404

    async def test_admin_can_get_any_report(
        self, client: AsyncClient, user_token: str, admin_token: str, minimal_jpeg: bytes
    ):
        create_r = await _submit_report(client, user_token, minimal_jpeg)
        report_id = create_r.json()["id"]

        r = await client.get(
            f"/api/reports/{report_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 200

    async def test_my_reports_only_own(
        self, client: AsyncClient, user_token: str, admin_token: str, minimal_jpeg: bytes
    ):
        # Submit one report as user, one as admin
        await _submit_report(client, user_token, minimal_jpeg)
        await _submit_report(client, admin_token, minimal_jpeg)

        r = await client.get(
            "/api/reports/my",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert r.status_code == 200
        data = r.json()
        # All returned reports must belong to the user
        me_r = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {user_token}"})
        my_id = me_r.json()["id"]
        for item in data["items"]:
            assert item["user_id"] == my_id

    async def test_user_cannot_update_review_status(
        self, client: AsyncClient, user_token: str, minimal_jpeg: bytes
    ):
        create_r = await _submit_report(client, user_token, minimal_jpeg)
        report_id = create_r.json()["id"]
        r = await client.patch(
            f"/api/reports/{report_id}/status",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"review_status": "reviewed"},
        )
        assert r.status_code == 403

    async def test_admin_can_update_review_status(
        self, client: AsyncClient, user_token: str, admin_token: str, minimal_jpeg: bytes
    ):
        create_r = await _submit_report(client, user_token, minimal_jpeg)
        report_id = create_r.json()["id"]
        r = await client.patch(
            f"/api/reports/{report_id}/status",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"review_status": "reviewed"},
        )
        assert r.status_code == 200
        assert r.json()["review_status"] == "reviewed"


class TestImageAccess:
    async def test_user_can_get_own_image(
        self, client: AsyncClient, user_token: str, minimal_jpeg: bytes
    ):
        create_r = await _submit_report(client, user_token, minimal_jpeg)
        report_id = create_r.json()["id"]
        r = await client.get(
            f"/api/reports/{report_id}/image",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert r.status_code == 200
        assert len(r.content) > 0
        assert r.content == minimal_jpeg
        assert r.headers["content-type"] == "image/jpeg"

    async def test_user_cannot_get_others_image(
        self, client: AsyncClient, user_token: str, admin_token: str, minimal_jpeg: bytes
    ):
        create_r = await _submit_report(client, admin_token, minimal_jpeg)
        report_id = create_r.json()["id"]
        r = await client.get(
            f"/api/reports/{report_id}/image",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert r.status_code == 404


class TestGeneratedAnalysisImages:
    async def test_retry_keeps_previous_results_until_a_new_run_succeeds(
        self,
        client: AsyncClient,
        user_token: str,
        minimal_jpeg: bytes,
        db: AsyncSession,
    ):
        from sqlalchemy import select

        from app.models.report import Detection, Report

        response = await _submit_report(client, user_token, minimal_jpeg)
        report_id = response.json()["id"]
        report = (
            await db.execute(select(Report).where(Report.id == report_id))
        ).scalar_one()
        report.processing_status = "failed"
        report.ai_analysis = {"severity": "Low", "artifacts": {"generation": "a" * 32}}
        db.add(
            Detection(
                id=str(uuid.uuid4()),
                report_id=report_id,
                predicted_class="pile",
                confidence=0.9,
            )
        )
        await db.commit()

        retry_response = await client.post(
            f"/api/reports/{report_id}/retry",
            headers={"Authorization": f"Bearer {user_token}"},
        )

        assert retry_response.status_code == 200
        assert retry_response.json()["ai_analysis"]["severity"] == "Low"
        assert len(retry_response.json()["detections"]) == 1

    async def test_owner_can_get_generated_images_and_other_user_cannot(
        self,
        client: AsyncClient,
        user_token: str,
        admin_token: str,
        minimal_jpeg: bytes,
        db: AsyncSession,
        tmp_path: Path,
        monkeypatch,
    ):
        from sqlalchemy import select

        from app.core.config import get_settings
        from app.models.report import Report

        settings = get_settings()
        monkeypatch.setattr(settings, "generated_analysis_dir", str(tmp_path))

        own_response = await _submit_report(client, user_token, minimal_jpeg)
        other_response = await _submit_report(client, admin_token, minimal_jpeg)
        own_id = own_response.json()["id"]
        other_id = other_response.json()["id"]
        generation = uuid.uuid4().hex
        detection_id = str(uuid.uuid4())

        for report_id in (own_id, other_id):
            output_dir = tmp_path / report_id / generation
            output_dir.mkdir(parents=True)
            (output_dir / "annotated.jpg").write_bytes(b"annotated image")
            (output_dir / "crop.jpg").write_bytes(b"cropped image")
            report = (
                await db.execute(select(Report).where(Report.id == report_id))
            ).scalar_one()
            report.ai_analysis = {
                "artifacts": {
                    "generation": generation,
                    "annotated": f"{report_id}/{generation}/annotated.jpg",
                    "detection_crops": {
                        detection_id: f"{report_id}/{generation}/crop.jpg"
                    },
                }
            }
        await db.commit()

        own_image = await client.get(
            f"/api/reports/{own_id}/analysis-images/annotated",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        own_crop = await client.get(
            f"/api/reports/{own_id}/analysis-images/crops/{detection_id}",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        other_image = await client.get(
            f"/api/reports/{other_id}/analysis-images/annotated",
            headers={"Authorization": f"Bearer {user_token}"},
        )

        assert own_image.status_code == 200
        assert own_image.content == b"annotated image"
        assert own_image.headers["content-type"] == "image/jpeg"
        assert own_crop.status_code == 200
        assert own_crop.content == b"cropped image"
        assert own_crop.headers["content-type"] == "image/jpeg"
        assert other_image.status_code == 404

    async def test_missing_generated_image_returns_not_found(
        self, client: AsyncClient, user_token: str, minimal_jpeg: bytes
    ):
        response = await _submit_report(client, user_token, minimal_jpeg)
        report_id = response.json()["id"]
        image_response = await client.get(
            f"/api/reports/{report_id}/analysis-images/depth",
            headers={"Authorization": f"Bearer {user_token}"},
        )

        assert image_response.status_code == 404
