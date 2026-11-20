"""IP parsing / classification helpers for connection intelligence."""

from __future__ import annotations

import ipaddress
import re


def parse_remote_ip(remote: str | None) -> str | None:
    """Extract IPv4/IPv6 host from psutil-style endpoint strings."""
    if not remote or remote in ("-", "none", "None"):
        return None
    s = remote.strip()
    if s.startswith("["):
        m = re.match(r"^\[([^\]]+)\](?::(\d+))?$", s)
        return m.group(1) if m else None
    if "." in s and ":" in s:
        return s.rsplit(":", 1)[0]
    if s.count(":") > 1 and not s.startswith("::"):
        return s.split("%", 1)[0]
    if "." in s:
        return s.split(":", 1)[0]
    if ":" in s:
        host, _, _ = s.rpartition(":")
        return host or None
    return None


def is_private_or_local_ip(ip: str) -> bool:
    """Return True for RFC1918, loopback, link-local, ULA, unspecified."""
    try:
        addr = ipaddress.ip_address(ip.split("%", 1)[0])
        return bool(
            addr.is_private
            or addr.is_loopback
            or addr.is_link_local
            or addr.is_reserved
            or addr.is_multicast
            or addr.is_unspecified
        )
    except ValueError:
        return True


def is_external_ip(ip: str) -> bool:
    return not is_private_or_local_ip(ip)
