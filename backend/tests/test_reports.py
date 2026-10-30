"""EcoWatch AI — Report upload, persistence, and RBAC tests."""

from __future__ import annotations

import io

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
