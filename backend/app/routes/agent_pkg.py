"""Serve a downloadable agent package for onboarding."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.deps import get_current_user

router = APIRouter(prefix="/agent", tags=["agent"])

PYTHON_FILES = (
    "agent.py",
    "collectors.py",
    "requirements.txt",
    "run.py",
)

GO_FILES = (
    "main.go",
    "collector.go",
    "buffer.go",
    "remediator.go",
    "go.mod",
    "go.sum",
    "README.md",
)

README = """Monitor host agent
====================

Preferred (Go — lightweight, heartbeats, remediation):

  cd agent-go
  go run .
  # or: go build -o monitor-agent.exe . && .\\monitor-agent.exe

Python fallback:

  cd agent
  python run.py

Env:
  AGENT_WS_URL   default ws://localhost:8002/ws/metrics
  DEVICE_ID      default hostname
  AGENT_INTERVAL default 3s
  AGENT_BUFFER   Go only — offline buffer window (default 12s)

Remediation allowlist (Go agent): restart_service, restart_container only.
"""


def _repo_root() -> Path:
    # backend/app/routes -> repo root
    return Path(__file__).resolve().parents[3]


@router.get("/download")
async def download_agent(
    _user: Annotated[str, Depends(get_current_user)],
) -> StreamingResponse:
    """Zip Python + Go agent sources for first-run setup."""
    root = _repo_root()
    py_root = root / "agent"
    go_root = root / "agent-go"
    if not py_root.is_dir():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent package is not available on this server",
        )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("monitor-agent/README.txt", README)
        for name in PYTHON_FILES:
            path = py_root / name
            if path.is_file():
                zf.write(path, arcname=f"monitor-agent/agent/{name}")
        if go_root.is_dir():
            for name in GO_FILES:
                path = go_root / name
                if path.is_file():
                    zf.write(path, arcname=f"monitor-agent/agent-go/{name}")
            exe = go_root / "monitor-agent.exe"
            if exe.is_file():
                zf.write(exe, arcname="monitor-agent/agent-go/monitor-agent.exe")

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="monitor-agent.zip"',
        },
    )
