"""EcoWatch AI — Hotspot and dashboard tests."""

from __future__ import annotations

import io

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.asyncio


async def _submit_report(client, token, jpeg, lat=12.97, lng=77.59):
    return await client.post(
        "/api/reports",
        headers={"Authorization": f"Bearer {token}"},
        files={"image": ("t.jpg", io.BytesIO(jpeg), "image/jpeg")},
        data={"latitude": str(lat), "longitude": str(lng)},
    )


class TestHotspots:
    async def test_no_reports_returns_empty(self, client: AsyncClient, admin_token: str):
        r = await client.get("/api/hotspots", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        data = r.json()
        assert data["items"] == []
        assert data["total"] == 0

    async def test_hotspot_from_reports(
        self, client: AsyncClient, admin_token: str, user_token: str, minimal_jpeg: bytes
    ):
        # Submit several reports at same location
        for _ in range(3):
            await _submit_report(client, user_token, minimal_jpeg, lat=12.97, lng=77.59)

        r = await client.get("/api/hotspots", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 1
        hs = data["items"][0]
        assert hs["report_count"] >= 3
        assert hs["severity"] in ("low", "medium", "high", "critical")
        assert hs["color"].startswith("#")

    async def test_nearby_reports_cluster_together(
        self, client: AsyncClient, admin_token: str, user_token: str, minimal_jpeg: bytes
    ):
        """Reports within 30m of each other should cluster into one hotspot."""
        # ~10m apart (well within 30m radius)
        await _submit_report(client, user_token, minimal_jpeg, lat=12.9716, lng=77.5946)
        await _submit_report(client, user_token, minimal_jpeg, lat=12.97161, lng=77.59461)

        r = await client.get("/api/hotspots", headers={"Authorization": f"Bearer {admin_token}"})
        data = r.json()
        # The two nearby reports should be in the same cluster
        counts = [h["report_count"] for h in data["items"]]
        assert max(counts) >= 2

    async def test_hotspot_rejects_regular_user(self, client: AsyncClient, user_token: str):
        r = await client.get("/api/hotspots", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 403

    async def test_severity_thresholds(self):
        """Severity function produces correct levels based on count."""
        from app.services.hotspot_service import _severity

        assert _severity(0) == "low"
        assert _severity(1) == "low"
        assert _severity(3) == "medium"
        assert _severity(6) == "high"
        assert _severity(10) == "critical"


class TestDashboard:
    async def test_stats_empty_db(self, client: AsyncClient, admin_token: str):
        r = await client.get("/api/dashboard/stats", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        data = r.json()
        assert data["total_reports"] >= 0
        assert isinstance(data["model_available"], bool)

    async def test_stats_counts_match_db(
        self, client: AsyncClient, admin_token: str, user_token: str, minimal_jpeg: bytes
    ):
        before = (await client.get(
            "/api/dashboard/stats", headers={"Authorization": f"Bearer {admin_token}"}
        )).json()["total_reports"]

        await _submit_report(client, user_token, minimal_jpeg)

        after = (await client.get(
            "/api/dashboard/stats", headers={"Authorization": f"Bearer {admin_token}"}
        )).json()["total_reports"]

        assert after == before + 1

    async def test_trends_returns_date_range(self, client: AsyncClient, admin_token: str):
        r = await client.get(
            "/api/dashboard/trends?days=7",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["days"] == 7
        assert len(data["observations_by_date"]) == 7

    async def test_dashboard_rejects_user(self, client: AsyncClient, user_token: str):
        r = await client.get("/api/dashboard/stats", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 403


class TestHealth:
    async def test_health_ok(self, client: AsyncClient):
        r = await client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["database"] is True

    async def test_model_health_unavailable(self, client: AsyncClient):
        """Model reports unavailable when MODEL_PATH is unset."""
        r = await client.get("/api/health/model")
        assert r.status_code == 200
        data = r.json()
        assert data["available"] is False  # no checkpoint in test env


class TestModelService:
    # Note: these tests are synchronous — no pytestmark applied
    def test_model_unavailable_when_no_path(self):
        """Backend starts and model service correctly reports unavailability."""
        from app.services.model_service import model_service

        assert model_service.is_available is False

    def test_no_fabricated_detections(self):
        """Inference raises ModelUnavailableError — never returns fake detections."""
        from app.core.exceptions import ModelUnavailableError
        from app.services.model_service import model_service

        with pytest.raises(ModelUnavailableError):
            model_service.run_inference(b"fake image bytes")
