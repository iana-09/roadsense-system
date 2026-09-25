"""Resolve public IP addresses to displayable locations for audit logs."""

from __future__ import annotations

import ipaddress
import logging
from threading import Lock

import httpx

from config import settings

logger = logging.getLogger(__name__)

_cache: dict[str, str] = {}
_lock = Lock()


def resolve_ip_location(ip_address: str | None) -> str:
    ip = (ip_address or "").strip()
    if not ip or ip.lower() == "unknown":
        return "Unknown location"

    try:
        parsed = ipaddress.ip_address(ip)
    except ValueError:
        return "Unknown location"

    if parsed.is_loopback:
        return "Localhost"
    if parsed.is_private:
        return "Local network"
    if parsed.is_reserved or parsed.is_multicast or parsed.is_unspecified:
        return "Unknown location"

    with _lock:
        cached = _cache.get(ip)
    if cached:
        return cached

    location = _lookup_public_ip(ip)
    with _lock:
        _cache[ip] = location
    return location


def _lookup_public_ip(ip: str) -> str:
    try:
        response = httpx.get(
            f"{settings.IP_LOCATION_API_URL.rstrip('/')}/{ip}",
            timeout=2.5,
            headers={"User-Agent": settings.GEOCODER_USER_AGENT},
        )
        response.raise_for_status()
        data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("IP location lookup failed for %s: %s", ip, exc)
        return "Unknown location"

    if data.get("success") is False:
        return "Unknown location"

    parts = [
        data.get("city"),
        data.get("region"),
        data.get("country"),
    ]
    location = ", ".join(str(part).strip() for part in parts if part)
    return location or "Unknown location"
