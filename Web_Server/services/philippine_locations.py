"""Philippine locality validation and city-boundary checks."""

import re
import threading
import unicodedata
from collections import Counter
from typing import Any

import httpx
from fastapi import HTTPException

from config import settings


_cache_lock = threading.Lock()
_regions_cache: list[dict] | None = None
_cities_cache: list[dict] | None = None
_region_cities_cache: dict[str, list[dict]] = {}
_barangays_cache: dict[str, list[dict]] = {}
_boundary_cache: dict[str, dict] = {}


def _repair_mojibake(value: str) -> str:
    """Repair UTF-8 text that was accidentally decoded as Latin-1/Windows-1252."""
    repaired = value
    for _ in range(2):
        if not any(marker in repaired for marker in ("Ã", "Â", "â")):
            break
        for encoding in ("cp1252", "latin-1"):
            try:
                candidate = repaired.encode(encoding).decode("utf-8")
            except (UnicodeEncodeError, UnicodeDecodeError):
                continue
            if candidate != repaired:
                repaired = candidate
                break
        else:
            break
    return repaired


def _normalize(value: str) -> str:
    value = _repair_mojibake(value)
    value = re.sub(r"^(city|municipality)\s+of\s+", "", value.strip(), flags=re.I)
    value = re.sub(r"\s+(city|municipality)$", "", value, flags=re.I)
    value = re.sub(r"\s+", " ", value)
    value = unicodedata.normalize("NFKD", value)
    value = "".join(character for character in value if not unicodedata.combining(character))
    return value.casefold()


def _get_json(url: str, params: dict | None = None) -> Any:
    try:
        response = httpx.get(
            url,
            params=params,
            headers={"User-Agent": settings.GEOCODER_USER_AGENT},
            timeout=20.0,
            follow_redirects=True,
        )
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(503, f"Philippine location service unavailable: {exc}")


def search_location_suggestions(query: str, limit: int = 5) -> list[dict]:
    term = query.strip()
    if len(term) < 2:
        return []

    data = _get_json(
        f"{settings.NOMINATIM_URL.rstrip('/')}/search",
        params={
            "q": term,
            "format": "jsonv2",
            "limit": max(1, min(limit, 8)),
            "countrycodes": "ph",
            "addressdetails": 1,
            "accept-language": "en",
        },
    )

    suggestions = []
    for item in data:
        try:
            latitude = float(item["lat"])
            longitude = float(item["lon"])
        except (KeyError, TypeError, ValueError):
            continue

        address = item.get("address") or {}
        title = (
            address.get("amenity")
            or address.get("road")
            or address.get("neighbourhood")
            or address.get("suburb")
            or address.get("village")
            or address.get("town")
            or address.get("city")
            or item.get("name")
            or str(item.get("display_name", "")).split(",")[0]
        )
        suggestions.append({
            "display_name": item.get("display_name") or title,
            "title": title,
            "subtitle": ", ".join(filter(None, [
                address.get("barangay") or address.get("suburb") or address.get("village"),
                address.get("city") or address.get("town") or address.get("municipality"),
                address.get("state"),
            ])),
            "latitude": latitude,
            "longitude": longitude,
            "type": item.get("type"),
        })

    return suggestions


def get_regions() -> list[dict]:
    global _regions_cache
    with _cache_lock:
        if _regions_cache is not None:
            return _regions_cache

    data = _get_json(f"{settings.PSGC_API_URL.rstrip('/')}/regions")
    regions = [
        {"code": str(item["code"]), "name": str(item["name"]).strip()}
        for item in data
        if item.get("code") and item.get("name")
    ]
    regions.sort(key=lambda item: _normalize(item["name"]))
    with _cache_lock:
        _regions_cache = regions
    return regions


def get_cities(region_code: str | None = None) -> list[dict]:
    global _cities_cache
    if region_code:
        with _cache_lock:
            cached = _region_cities_cache.get(region_code)
            if cached is not None:
                return cached
        if not any(region["code"] == region_code for region in get_regions()):
            raise HTTPException(400, "Invalid Philippine region.")
        region_prefix = region_code[:2]
        cities = [
            item for item in get_cities()
            if item["code"].startswith(region_prefix)
        ]
        with _cache_lock:
            _region_cities_cache[region_code] = cities
        return cities

    with _cache_lock:
        if _cities_cache is not None:
            return _cities_cache

    data = _get_json(f"{settings.PSGC_API_URL.rstrip('/')}/cities-municipalities")
    regions_by_prefix = {item["code"][:2]: item["code"] for item in get_regions()}
    cities = [
        {
            "code": str(item["code"]),
            "name": str(item["name"]).strip(),
            "type": item.get("type", ""),
            "region_code": str(
                item.get("regionCode")
                or regions_by_prefix.get(str(item["code"])[:2], "")
            ),
        }
        for item in data
        if item.get("code") and item.get("name")
        and str(item.get("type", "")).casefold() != "submun"
    ]
    cities.sort(key=lambda item: _normalize(item["name"]))
    with _cache_lock:
        _cities_cache = cities
    return cities


def get_barangays(city_code: str) -> list[dict]:
    with _cache_lock:
        cached = _barangays_cache.get(city_code)
        if cached is not None:
            return cached

    valid_city = next((item for item in get_cities() if item["code"] == city_code), None)
    if not valid_city:
        raise HTTPException(400, "Invalid Philippine city or municipality.")

    data = _get_json(
        f"{settings.PSGC_API_URL.rstrip('/')}/cities-municipalities/{city_code}/barangays"
    )
    barangays = [
        {"code": str(item["code"]), "name": str(item["name"]).strip()}
        for item in data
        if item.get("code") and item.get("name")
    ]
    barangays.sort(key=lambda item: _normalize(item["name"]))
    with _cache_lock:
        _barangays_cache[city_code] = barangays
    return barangays


def validate_locality(region_code: str, city_code: str, barangay_code: str) -> dict:
    region = next((item for item in get_regions() if item["code"] == region_code), None)
    if not region:
        raise HTTPException(400, "Invalid Philippine region.")

    city = next((item for item in get_cities(region_code) if item["code"] == city_code), None)
    if not city:
        raise HTTPException(400, "The selected city or municipality does not belong to that region.")

    barangay = next(
        (item for item in get_barangays(city_code) if item["code"] == barangay_code),
        None,
    )
    if not barangay:
        raise HTTPException(
            400,
            "The selected barangay does not belong to that city or municipality.",
        )
    return {
        "region": region["name"],
        "region_code": region["code"],
        "city": city["name"],
        "city_code": city["code"],
        "barangay": barangay["name"],
        "barangay_code": barangay["code"],
    }


def resolve_saved_locality(city_name: str, barangay_name: str) -> dict | None:
    city_matches = [
        city for city in get_cities()
        if _normalize(city["name"]) == _normalize(city_name)
    ]
    regions = {region["code"]: region for region in get_regions()}
    for city in city_matches:
        barangay = next(
            (
                item for item in get_barangays(city["code"])
                if _normalize(item["name"]) == _normalize(barangay_name)
            ),
            None,
        )
        region = regions.get(city.get("region_code"))
        if barangay and region:
            return {
                "region": region["name"],
                "region_code": region["code"],
                "city": city["name"],
                "city_code": city["code"],
                "barangay": barangay["name"],
                "barangay_code": barangay["code"],
            }
    return None


def _region_name_matches(psgc_name: str, geocoder_name: str) -> bool:
    left = _normalize(psgc_name)
    right = _normalize(geocoder_name)
    if left == right or left in right or right in left:
        return True
    return (
        ("national capital region" in left and right in {"metro manila", "manila"})
        or ("bangsamoro" in left and "muslim mindanao" in right)
    )


def reverse_geocode_locality(latitude: float, longitude: float) -> dict | None:
    result = _get_json(
        f"{settings.NOMINATIM_URL.rstrip('/')}/reverse",
        params={
            "lat": latitude,
            "lon": longitude,
            "format": "jsonv2",
            "addressdetails": 1,
            "zoom": 10,
            "countrycodes": "ph",
        },
    )
    address = result.get("address") or {}
    city_name = next(
        (address.get(key) for key in ("city", "municipality", "town", "county") if address.get(key)),
        None,
    )
    region_name = address.get("state") or address.get("region")
    if not city_name:
        return None

    region = next(
        (item for item in get_regions() if region_name and _region_name_matches(item["name"], region_name)),
        None,
    )
    candidates = get_cities(region["code"]) if region else get_cities()
    city = next((item for item in candidates if _normalize(item["name"]) == _normalize(city_name)), None)
    if not city:
        return None

    if not region:
        region = next(
            (item for item in get_regions() if item["code"] == city.get("region_code")),
            None,
        )
    return {
        "region": region["name"] if region else region_name,
        "region_code": region["code"] if region else city.get("region_code"),
        "city": city["name"],
        "city_code": city["code"],
    }


def resolve_gps_trace_locality(payload: dict) -> dict | None:
    points = payload.get("gps_points") or payload.get("locations") or []
    points = [
        point for point in points
        if isinstance(point, dict)
        and point.get("latitude") is not None
        and point.get("longitude") is not None
    ]
    if not points:
        return None

    sample_indexes = sorted({0, len(points) // 2, len(points) - 1})
    localities = []
    for index in sample_indexes:
        point = points[index]
        locality = reverse_geocode_locality(
            float(point["latitude"]),
            float(point["longitude"]),
        )
        if locality:
            localities.append(locality)
    if not localities:
        return None

    winning_code = Counter(item["city_code"] for item in localities).most_common(1)[0][0]
    return next(item for item in localities if item["city_code"] == winning_code)


def _point_in_ring(longitude: float, latitude: float, ring: list[list[float]]) -> bool:
    inside = False
    j = len(ring) - 1
    for i, point in enumerate(ring):
        xi, yi = point[0], point[1]
        xj, yj = ring[j][0], ring[j][1]
        intersects = (
            (yi > latitude) != (yj > latitude)
            and longitude < (xj - xi) * (latitude - yi) / ((yj - yi) or 1e-15) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def _point_in_polygon(longitude: float, latitude: float, polygon: list) -> bool:
    if not polygon or not _point_in_ring(longitude, latitude, polygon[0]):
        return False
    return not any(_point_in_ring(longitude, latitude, hole) for hole in polygon[1:])


def _point_in_geojson(longitude: float, latitude: float, geojson: dict) -> bool:
    geometry_type = geojson.get("type")
    coordinates = geojson.get("coordinates") or []
    if geometry_type == "Polygon":
        return _point_in_polygon(longitude, latitude, coordinates)
    if geometry_type == "MultiPolygon":
        return any(_point_in_polygon(longitude, latitude, polygon) for polygon in coordinates)
    return False


def get_city_boundary(city_name: str, region_name: str | None = None) -> dict:
    city_key = _normalize(city_name)
    cache_key = f"{_normalize(region_name or '')}:{city_key}"
    with _cache_lock:
        cached = _boundary_cache.get(cache_key)
        if cached is not None:
            return cached

    repaired_city_name = _repair_mojibake(city_name).strip()
    repaired_region_name = _repair_mojibake(region_name or "").strip()
    query_name = re.sub(
        r"^(City|Municipality)\s+of\s+",
        "",
        repaired_city_name,
        flags=re.I,
    )

    def find_boundary(results: list[dict]) -> dict | None:
        return next(
            (
                item["geojson"]
                for item in results
                if item.get("geojson", {}).get("type") in ("Polygon", "MultiPolygon")
                and city_key
                in {
                    _normalize(candidate)
                    for candidate in (
                        item.get("address", {}).get("city", ""),
                        item.get("address", {}).get("municipality", ""),
                        item.get("address", {}).get("town", ""),
                        item.get("name", ""),
                    )
                    if candidate
                }
            ),
            None,
        )

    search_url = f"{settings.NOMINATIM_URL.rstrip('/')}/search"
    search_params = {
        "format": "jsonv2",
        "polygon_geojson": 1,
        "addressdetails": 1,
        "limit": 8,
        "countrycodes": "ph",
    }
    queries = [
        ", ".join(
            part
            for part in (query_name, repaired_region_name, "Philippines")
            if part
        )
    ]
    if repaired_region_name:
        queries.append(f"{query_name}, Philippines")

    boundary = None
    for query in queries:
        boundary = find_boundary(_get_json(search_url, params={**search_params, "q": query}))
        if boundary is not None:
            break
    if boundary is None:
        raise HTTPException(
            503,
            f"Could not resolve the boundary for {repaired_city_name}.",
        )

    with _cache_lock:
        _boundary_cache[cache_key] = boundary
    return boundary


def point_is_in_city(
    latitude: float,
    longitude: float,
    city_name: str,
    region_name: str | None = None,
) -> bool:
    return _point_in_geojson(
        longitude,
        latitude,
        get_city_boundary(city_name, region_name),
    )
