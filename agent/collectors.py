"""
Synchronous metric collectors for psutil-heavy work.

Designed to run under ``asyncio.to_thread`` so the event loop stays responsive.
"""

from __future__ import annotations

import ipaddress
import logging
import platform
import re
import subprocess
import time
from typing import Any

import psutil

logger = logging.getLogger(__name__)

MAX_CONN_SAMPLE = 120
MAX_PROC_ITER = 900
MAX_NEW_PROC_DETAIL = 24


def _parse_remote_ip(remote: str | None) -> str | None:
    if not remote or remote in ("-", "none", "None"):
        return None
    s = remote.strip()
    if s.startswith("["):
        m = re.match(r"^\[([^\]]+)\](?::(\d+))?$", s)
        return m.group(1) if m else None
    if "." in s and ":" in s:
        return s.rsplit(":", 1)[0]
    if s.count(":") > 1:
        return s.split("%", 1)[0]
    if "." in s:
        return s.split(":", 1)[0]
    if ":" in s:
        host, _, _ = s.rpartition(":")
        return host or None
    return None


def _is_external_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip.split("%", 1)[0])
        return not (
            addr.is_private
            or addr.is_loopback
            or addr.is_link_local
            or addr.is_reserved
            or addr.is_multicast
            or addr.is_unspecified
        )
    except ValueError:
        return False


def _fmt_addr(addr) -> str | None:
    if not addr:
        return None
    ip, port = addr
    ip_s = f"[{ip}]" if ":" in str(ip) else str(ip)
    return f"{ip_s}:{port}"


def _measure_ping(host: str = "8.8.8.8") -> tuple[float | None, float | None]:
    """Return (latency_ms_avg, packet_loss_percent)."""
    system = platform.system().lower()
    try:
        if system == "windows":
            cmd = ["ping", "-n", "5", "-w", "750", host]
        else:
            cmd = ["ping", "-c", "5", "-W", "1", host]
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=12,
        )
        text = (proc.stdout or "") + "\n" + (proc.stderr or "")
        loss_m = re.search(r"(\d+)%\s+loss", text, re.IGNORECASE)
        loss = float(loss_m.group(1)) if loss_m else None

        times: list[float] = []
        for m in re.finditer(
            r"(?:time|temps|zeit)=<?(\d+(?:\.\d+)?)\s*m?s",
            text,
            re.IGNORECASE,
        ):
            try:
                times.append(float(m.group(1)))
            except ValueError:
                continue
        if not times:
            for m in re.finditer(
                r"(?:minimum|moyenne|average|media)\s*=\s*(\d+(?:\.\d+)?)\s*m?s",
                text,
                re.IGNORECASE,
            ):
                try:
                    times.append(float(m.group(1)))
                except ValueError:
                    continue

        latency = sum(times) / len(times) if times else None
        return latency, loss
    except Exception:
        logger.debug("ping measurement failed", exc_info=True)
        return None, None


def collect_observation(
    prev_pids: set[int],
    prev_disk,
    net_delta_in: int,
    net_delta_out: int,
) -> tuple[dict[str, Any], set[int], Any]:
    """
    Build the extended observation payload plus updated disk counters state.

    Network deltas are computed by the agent loop (single ``net_io_counters()`` pair)
    to avoid inconsistent double-sampling.
    """
    now_disk = psutil.disk_io_counters()
    dr = dw = 0
    if prev_disk is not None and now_disk is not None:
        dr = max(0, int(now_disk.read_bytes - prev_disk.read_bytes))
        dw = max(0, int(now_disk.write_bytes - prev_disk.write_bytes))

    proc_infos: list[dict[str, Any]] = []
    scanned = 0
    try:
        for proc in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
            if scanned >= MAX_PROC_ITER:
                break
            scanned += 1
            try:
                info = proc.info
                pid = info.get("pid")
                if pid is None:
                    continue
                name = info.get("name") or "?"
                cpu_p = float(info.get("cpu_percent") or 0.0)
                mem_p = float(info.get("memory_percent") or 0.0)
                proc_infos.append(
                    {
                        "pid": int(pid),
                        "name": str(name),
                        "cpu_percent": round(cpu_p, 1),
                        "memory_percent": round(mem_p, 1),
                    }
                )
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
    except Exception:
        logger.exception("batch process_iter failed; using per-PID fallback")

    if len(proc_infos) < 8:
        existing = {r["pid"] for r in proc_infos}
        for pid in sorted(psutil.pids())[:400]:
            if pid in existing:
                continue
            try:
                proc = psutil.Process(pid)
                with proc.oneshot():
                    name = proc.name()
                    cpu_p = float(proc.cpu_percent(interval=None))
                    mem_p = float(proc.memory_percent())
                proc_infos.append(
                    {
                        "pid": pid,
                        "name": name,
                        "cpu_percent": round(cpu_p, 1),
                        "memory_percent": round(mem_p, 1),
                    }
                )
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue

    uniq: dict[int, dict[str, Any]] = {}
    for row in proc_infos:
        uniq[int(row["pid"])] = row
    proc_infos = list(uniq.values())

    top_cpu = sorted(proc_infos, key=lambda x: x["cpu_percent"], reverse=True)[:5]
    top_mem = sorted(proc_infos, key=lambda x: x["memory_percent"], reverse=True)[:5]

    current_pids = set(psutil.pids())
    new_processes: list[dict[str, Any]] = []
    if prev_pids:
        brand_new = current_pids - prev_pids
        for pid in list(brand_new)[:MAX_NEW_PROC_DETAIL]:
            try:
                p = psutil.Process(pid)
                new_processes.append({"pid": pid, "name": p.name()})
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

    connections_sample: list[dict[str, str]] = []
    external_conn = 0
    total_connections = 0
    try:
        all_conns = psutil.net_connections(kind="inet")
        total_connections = len(all_conns)
        for c in all_conns:
            try:
                laddr = _fmt_addr(getattr(c, "laddr", None))
                raddr = _fmt_addr(getattr(c, "raddr", None))
                remote_ip = _parse_remote_ip(raddr)
                if remote_ip and _is_external_ip(remote_ip):
                    external_conn += 1
                if len(connections_sample) < MAX_CONN_SAMPLE:
                    connections_sample.append(
                        {
                            "local": laddr or "-",
                            "remote": raddr or "-",
                            "status": str(getattr(c, "status", "") or ""),
                        }
                    )
            except Exception:
                continue
    except (psutil.AccessDenied, PermissionError):
        logger.debug("net_connections unavailable (permissions)")

    latency_ms, loss_pct = _measure_ping()

    partitions: list[dict[str, Any]] = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
            partitions.append(
                {
                    "mountpoint": part.mountpoint,
                    "fstype": getattr(part, "fstype", "") or "",
                    "total_bytes": int(usage.total),
                    "used_bytes": int(usage.used),
                    "percent": round(float(usage.percent), 1),
                }
            )
        except (PermissionError, OSError):
            continue

    thread_total = 0
    counted = 0
    for proc in psutil.process_iter(["num_threads"]):
        if counted >= 1600:
            break
        counted += 1
        try:
            thread_total += int(proc.info.get("num_threads") or 0)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    observation: dict[str, Any] = {
        "processes": {
            "top_cpu": top_cpu,
            "top_memory": top_mem,
            "new_processes": new_processes,
        },
        "network": {
            "connection_count": int(total_connections),
            "external_connection_count": external_conn,
            "latency_ms": round(latency_ms, 2) if latency_ms is not None else None,
            "packet_loss_percent": round(loss_pct, 2) if loss_pct is not None else None,
            "connections_sample": connections_sample,
            "network_in_delta": int(net_delta_in),
            "network_out_delta": int(net_delta_out),
        },
        "disk": {
            "partitions": partitions,
            "read_bytes_delta": int(dr),
            "write_bytes_delta": int(dw),
        },
        "system": {
            "uptime_seconds": int(time.time() - psutil.boot_time()),
            "process_count": len(current_pids),
            "thread_count": int(thread_total),
        },
    }

    return observation, current_pids, now_disk
