import logging
import time

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.models.schemas import RouteRequest, RouteResponse, GPXRequest
from app.services.overpass import fetch_street_network, validate_area
from app.services.routing import calculate_route
from app.services.gpx import generate_gpx, generate_gpx_with_waypoints
from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/route", tags=["routes"])

# Average walking speed in km/h for time estimation
AVERAGE_SPEED_KMH = 5.0


@router.post("/calculate", response_model=RouteResponse)
async def calculate_optimal_route(request: RouteRequest):
    """
    Calculate the optimal route to cover all streets within the polygon,
    starting from the specified point.

    Uses the Chinese Postman algorithm to minimize repeated distance.
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
        start_time = time.time()
        G, _, _ = fetch_street_network(request.polygon)
        fetch_time = time.time() - start_time
        logger.info(f"OSM fetch completed in {fetch_time:.2f}s - {len(G.nodes())} nodes, {len(G.edges())} edges")

        if len(G.nodes()) == 0:
            raise HTTPException(
                status_code=400,
                detail="No streets found in the selected area"
            )

        # Calculate optimal route
        route_start = time.time()
        route_points, total_distance_km, unique_distance_km, overlap_percentage = calculate_route(
            G, request.start_point, honor_oneways=request.honor_oneways
        )
        route_time = time.time() - route_start
        logger.info(f"Route calculation completed in {route_time:.2f}s")

        # Estimate time based on walking speed
        estimated_time_minutes = (total_distance_km / AVERAGE_SPEED_KMH) * 60

        return RouteResponse(
            route=route_points,
            total_distance_km=round(total_distance_km, 2),
            unique_distance_km=round(unique_distance_km, 2),
            overlap_percentage=round(overlap_percentage, 1),
            estimated_time_minutes=round(estimated_time_minutes, 0)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate route: {str(e)}")


@router.post("/gpx")
async def generate_gpx_file(request: GPXRequest):
    """
    Generate a GPX file from the calculated route.

    Returns the GPX file as a downloadable attachment.
    """
    try:
        gpx_content = generate_gpx(request.route, request.name)

        return Response(
            content=gpx_content,
            media_type="application/gpx+xml",
            headers={
                "Content-Disposition": f'attachment; filename="{request.name.replace(" ", "_")}.gpx"'
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate GPX: {str(e)}")


@router.post("/gpx-with-waypoints")
async def generate_gpx_with_waypoints_file(request: GPXRequest):
    """
    Generate a GPX file with waypoints at street changes.

    Useful for turn-by-turn navigation.
    """
    try:
        gpx_content = generate_gpx_with_waypoints(
            request.route,
            request.name,
            include_waypoints=True
        )

        return Response(
            content=gpx_content,
            media_type="application/gpx+xml",
            headers={
                "Content-Disposition": f'attachment; filename="{request.name.replace(" ", "_")}_waypoints.gpx"'
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate GPX: {str(e)}")
