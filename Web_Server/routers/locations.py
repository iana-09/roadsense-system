"""Canonical Philippine city/municipality and barangay lookup routes."""

from fastapi import APIRouter, Query

from services.philippine_locations import (
    get_barangays,
    get_cities,
    get_regions,
    search_location_suggestions,
)


router = APIRouter(prefix="/api/locations", tags=["Locations"])


@router.get("/regions")
def list_regions():
    return {"regions": get_regions()}


@router.get("/cities")
def list_cities(region_code: str | None = None):
    return {"cities": get_cities(region_code)}


@router.get("/cities/{city_code}/barangays")
def list_barangays(city_code: str):
    return {"barangays": get_barangays(city_code)}


@router.get("/suggestions")
def suggest_locations(
    q: str = Query(..., min_length=2, max_length=120),
    limit: int = Query(5, ge=1, le=8),
):
    return {"suggestions": search_location_suggestions(q, limit)}
