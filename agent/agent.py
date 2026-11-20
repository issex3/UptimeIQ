#!/usr/bin/env python3
"""
Host agent: legacy scalar metrics plus structured ``observation`` payloads.

Heavy psutil work runs in a worker thread to avoid blocking the asyncio loop.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import socket
import time

import psutil
import websockets

from collectors import collect_observation

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)

WS_URL = os.environ.get("AGENT_WS_URL", "ws://localhost:8000/ws/metrics")
DEVICE_ID = os.environ.get("DEVICE_ID", socket.gethostname())
INTERVAL = float(os.environ.get("AGENT_INTERVAL", "3"))
BACKOFF = float(os.environ.get("AGENT_BACKOFF", "3"))


def build_payload(
    cpu: float,
    memory: float,
    network_in: int,
    network_out: int,
    observation: dict | None,
) -> dict:
    payload: dict = {
        "device_id": DEVICE_ID,
        "cpu": round(cpu, 1),
        "memory": round(memory, 1),
        "network_in": int(network_in),
        "network_out": int(network_out),
        "timestamp": int(time.time()),
    }
    if observation is not None:
        payload["observation"] = observation
    return payload


async def stream_metrics(ws) -> None:
    psutil.cpu_percent(interval=None)  # prime host CPU sampler
    prev_net = psutil.net_io_counters()
    prev_disk = psutil.disk_io_counters()
    prev_pids: set[int] = set()

    while True:
        cpu = float(psutil.cpu_percent(interval=None))
        mem = float(psutil.virtual_memory().percent)
        now_net = psutil.net_io_counters()
        delta_in = max(0, now_net.bytes_recv - prev_net.bytes_recv)
        delta_out = max(0, now_net.bytes_sent - prev_net.bytes_sent)
        prev_net = now_net

        observation, prev_pids, prev_disk = await asyncio.to_thread(
            collect_observation,
            prev_pids,
            prev_disk,
            delta_in,
            delta_out,
        )
        prev_net = now_net

        payload = build_payload(cpu, mem, delta_in, delta_out, observation)
        await ws.send(json.dumps(payload))
        logging.debug("sent payload keys=%s", list(payload.keys()))
        await asyncio.sleep(INTERVAL)


async def main() -> None:
    logging.info("Agent starting device=%s ws=%s", DEVICE_ID, WS_URL)
    while True:
        try:
            async with websockets.connect(
                WS_URL,
                ping_interval=20,
                ping_timeout=20,
                close_timeout=5,
            ) as ws:
                logging.info("Connected upstream")
                await stream_metrics(ws)
        except asyncio.CancelledError:
            raise
        except Exception:
            logging.exception("Connection lost; reconnecting in %.1fs", BACKOFF)
            await asyncio.sleep(BACKOFF)


if __name__ == "__main__":
    asyncio.run(main())
