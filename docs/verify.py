#!/usr/bin/env python3
"""Smoke-check a running Monitor API. Demo auth is MVP-only."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8002"


def req(method: str, path: str, token: str | None = None, body: dict | None = None):
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode()
    request = urllib.request.Request(
        f"{BASE}{path}", data=data, headers=headers, method=method
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"raw": raw}
        return e.code, payload


def main() -> int:
    print(f"Verifying {BASE} ...")
    status, login = req(
        "POST", "/auth/login", body={"username": "admin", "password": "admin123"}
    )
    if status != 200 or "access_token" not in login:
        print("FAIL login", status, login)
        return 1
    token = login["access_token"]

    status, allow = req("GET", "/remediation/allowlist", token=token)
    if status != 200 or "restart_service" not in allow.get("actions", []):
        print("FAIL allowlist", status, allow)
        return 1

    status, _ = req(
        "POST",
        "/remediation/propose",
        token=token,
        body={
            "device_id": "verify-host",
            "action_type": "rm",
            "target": "x",
            "reason": "no",
        },
    )
    if status != 400:
        print("FAIL expected 400 for bad action", status)
        return 1

    status, risk = req("GET", "/risk/verify-host", token=token)
    if status != 200 or not risk.get("disclaimer"):
        print("FAIL risk disclaimer", status, risk)
        return 1

    request = urllib.request.Request(
        f"{BASE}/agent/download",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(request, timeout=15) as resp:
        if resp.status != 200:
            print("FAIL agent download", resp.status)
            return 1
        blob = resp.read(16)
        if blob[:2] != b"PK":
            print("FAIL agent download not a zip")
            return 1

    print("OK - auth, allowlist reject, risk disclaimer, agent download")
    print("Demo credentials are MVP-only (admin/admin123).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
