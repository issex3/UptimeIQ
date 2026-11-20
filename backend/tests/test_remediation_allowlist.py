"""Allowlist and risk disclaimer smoke tests."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

pytestmark = pytest.mark.asyncio


async def test_login_and_allowlist():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/auth/login",
            json={"username": "admin", "password": "admin123"},
        )
        assert login.status_code == 200
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        allow = await client.get("/remediation/allowlist", headers=headers)
        assert allow.status_code == 200
        actions = set(allow.json()["actions"])
        assert actions == {"restart_service", "restart_container"}

        bad = await client.post(
            "/remediation/propose",
            headers=headers,
            json={
                "device_id": "test-host",
                "action_type": "shell_exec",
                "target": "id",
                "reason": "should fail",
            },
        )
        assert bad.status_code == 400

        ok = await client.post(
            "/remediation/propose",
            headers=headers,
            json={
                "device_id": "test-host",
                "action_type": "restart_service",
                "target": "demo-svc",
                "reason": "unit test",
            },
        )
        assert ok.status_code == 200
        assert ok.json()["status"] == "proposed"


async def test_risk_includes_disclaimer():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/auth/login",
            json={"username": "admin", "password": "admin123"},
        )
        token = login.json()["access_token"]
        res = await client.get(
            "/risk/test-host",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        body = res.json()
        assert "disclaimer" in body
        lower = body["disclaimer"].lower()
        assert "early" in lower or "not validated" in lower
