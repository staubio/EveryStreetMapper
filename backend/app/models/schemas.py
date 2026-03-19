from typing import List, Tuple, Optional
from pydantic import BaseModel, Field


class Coordinate(BaseModel):
    """A single coordinate point."""
    lat: float = Field(..., description="Latitude")
    lng: float = Field(..., description="Longitude")


class PolygonRequest(BaseModel):
    """Request containing a polygon defined by coordinates."""
    polygon: List[Coordinate] = Field(..., min_length=3, description="Polygon vertices")


class StreetSegment(BaseModel):
    """A street segment with coordinates."""
    id: str
    name: Optional[str] = None
    coordinates: List[Coordinate]
    oneway: bool = False


class StreetsResponse(BaseModel):
    """Response containing street data."""
    streets: List[StreetSegment]
    total_length_km: float
    area_sq_km: float


class RouteRequest(BaseModel):
    """Request to calculate optimal route."""
    polygon: List[Coordinate] = Field(..., min_length=3)
    start_point: Coordinate
    honor_oneways: bool = False  # Default: ignore one-ways (current behavior)


class RoutePoint(BaseModel):
    """A point in the calculated route."""
    lat: float
    lng: float
    street_name: Optional[str] = None


class RouteResponse(BaseModel):
    """Response containing the calculated route."""
    route: List[RoutePoint]
    total_distance_km: float
    unique_distance_km: float
    overlap_percentage: float
    estimated_time_minutes: float


class GPXRequest(BaseModel):
    """Request to generate GPX file."""
    route: List[RoutePoint]
    name: str = "EveryStreet Route"


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str = "1.0.0"
