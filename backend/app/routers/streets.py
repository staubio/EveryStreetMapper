from fastapi import APIRouter, HTTPException

from app.models.schemas import PolygonRequest, StreetsResponse
from app.services.overpass import fetch_street_network, validate_area, calculate_area_sq_km
from app.config import get_settings

router = APIRouter(prefix="/api/streets", tags=["streets"])


@router.post("", response_model=StreetsResponse)
async def get_streets(request: PolygonRequest):
    """
    Fetch all streets within the specified polygon from OpenStreetMap.

    The polygon area must be within the configured limit (default 5 sq km).
    """
    settings = get_settings()

    # Validate area
    is_valid, area_sq_km = validate_area(request.polygon)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"Area too large: {area_sq_km:.2f} sq km exceeds limit of {settings.max_area_sq_km} sq km"
        )

    try:
        # Fetch street network
        G, streets, total_length_km = fetch_street_network(request.polygon)

        return StreetsResponse(
            streets=streets,
            total_length_km=round(total_length_km, 2),
            area_sq_km=round(area_sq_km, 2)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch streets: {str(e)}")
