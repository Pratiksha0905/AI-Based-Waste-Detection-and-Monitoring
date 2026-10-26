"""EcoWatch AI — Auth and RBAC tests."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestRegistration:
    async def test_register_success(self, client: AsyncClient):
        r = await client.post(
            "/api/auth/register",
            json={"name": "Alice", "email": "alice@test.com", "password": "password123"},
        )
        assert r.status_code == 201
        data = r.json()
        assert data["email"] == "alice@test.com"
        assert data["role"] == "user"
        assert "hashed_password" not in data

    async def test_register_duplicate_email(self, client: AsyncClient):
        await client.post(
            "/api/auth/register",
            json={"name": "Bob", "email": "bob@test.com", "password": "password123"},
        )
        r = await client.post(
            "/api/auth/register",
            json={"name": "Bob2", "email": "bob@test.com", "password": "password123"},
        )
        assert r.status_code == 409

    async def test_register_cannot_set_admin_role(self, client: AsyncClient):
        """Any role field in registration body is ignored — server assigns 'user'."""
        r = await client.post(
            "/api/auth/register",
            json={"name": "Hacker", "email": "hacker@test.com", "password": "password123", "role": "admin"},
        )
        # Either 201 with role=user, or 422 if role is an unrecognised field
        if r.status_code == 201:
            assert r.json()["role"] == "user"

    async def test_register_short_password(self, client: AsyncClient):
        r = await client.post(
            "/api/auth/register",
            json={"name": "Short", "email": "short@test.com", "password": "abc"},
        )
        assert r.status_code == 422


class TestLogin:
    async def test_login_success(self, client: AsyncClient, user_token: str):
        assert isinstance(user_token, str) and len(user_token) > 10

    async def test_login_bad_password(self, client: AsyncClient):
        await client.post(
            "/api/auth/register",
            json={"name": "Cathy", "email": "cathy@test.com", "password": "password123"},
        )
        r = await client.post(
            "/api/auth/login",
            json={"email": "cathy@test.com", "password": "wrongpassword"},
        )
        assert r.status_code == 401

    async def test_login_unknown_email(self, client: AsyncClient):
        r = await client.post(
            "/api/auth/login",
            json={"email": "nobody@test.com", "password": "password123"},
        )
        assert r.status_code == 401


class TestProtectedEndpoints:
    async def test_me_requires_auth(self, client: AsyncClient):
        r = await client.get("/api/auth/me")
        assert r.status_code == 401

    async def test_me_returns_profile(self, client: AsyncClient, user_token: str):
        r = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 200
        assert r.json()["role"] == "user"

    async def test_admin_endpoint_rejects_user(self, client: AsyncClient, user_token: str):
        r = await client.get("/api/reports", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 403

    async def test_admin_can_access_reports(self, client: AsyncClient, admin_token: str):
        r = await client.get("/api/reports", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200

    async def test_hotspot_rejects_unauthenticated(self, client: AsyncClient):
        r = await client.get("/api/hotspots")
        assert r.status_code == 401

    async def test_hotspot_rejects_user(self, client: AsyncClient, user_token: str):
        r = await client.get("/api/hotspots", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 403

    async def test_dashboard_rejects_user(self, client: AsyncClient, user_token: str):
        r = await client.get("/api/dashboard/stats", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 403
