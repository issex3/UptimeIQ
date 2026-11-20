#!/usr/bin/env python3
"""One-command agent setup + start.

  python agent/run.py
"""

from __future__ import annotations

import os
import runpy
import socket
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REQUIREMENTS = ROOT / "requirements.txt"


def ensure_deps() -> None:
    try:
        import psutil  # noqa: F401
        import websockets  # noqa: F401
    except ImportError:
        print("Installing agent dependencies…")
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "-r", str(REQUIREMENTS), "-q"],
        )


def main() -> None:
    ensure_deps()
    os.environ.setdefault("AGENT_WS_URL", "ws://localhost:8002/ws/metrics")
    os.environ.setdefault("DEVICE_ID", socket.gethostname())
    os.environ.setdefault("AGENT_INTERVAL", "3")
    print(
        f"Starting agent device={os.environ['DEVICE_ID']} "
        f"ws={os.environ['AGENT_WS_URL']}"
    )
    runpy.run_path(str(ROOT / "agent.py"), run_name="__main__")


if __name__ == "__main__":
    main()
