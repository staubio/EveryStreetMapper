import logging
from typing import List, Tuple, Dict, Any

import osmnx as ox
import networkx as nx
from shapely.geometry import Polygon, shape
from shapely.ops import transform
import pyproj

from app.config import get_settings
from app.models.schemas import Coordinate, StreetSegment

logger = logging.getLogger(__name__)

# Configure OSMnx
ox.settings.use_cache = True
ox.settings.log_console = False


def calculate_area_sq_km(polygon_coords: List[Coordinate]) -> float:
    """Calculate the area of a polygon in square kilometers."""
    coords = [(c.lng, c.lat) for c in polygon_coords]
    polygon = Polygon(coords)

    # Transform to a projected CRS for accurate area calculation
    # Use UTM zone based on centroid
    centroid = polygon.centroid
    utm_zone = int((centroid.x + 180) / 6) + 1
    hemisphere = "north" if centroid.y >= 0 else "south"

    # Create transformer
    wgs84 = pyproj.CRS("EPSG:4326")
    utm = pyproj.CRS(f"+proj=utm +zone={utm_zone} +{hemisphere} +ellps=WGS84")
    project = pyproj.Transformer.from_crs(wgs84, utm, always_xy=True).transform

    # Transform and calculate area
    polygon_utm = transform(project, polygon)
    area_sq_m = polygon_utm.area
    area_sq_km = area_sq_m / 1_000_000

    return area_sq_km


def validate_area(polygon_coords: List[Coordinate]) -> Tuple[bool, float]:
    """Validate that the polygon area is within limits."""
    settings = get_settings()
    area_sq_km = calculate_area_sq_km(polygon_coords)
    is_valid = area_sq_km <= settings.max_area_sq_km
    return is_valid, area_sq_km


def fetch_street_network(polygon_coords: List[Coordinate]) -> Tuple[nx.MultiDiGraph, List[StreetSegment], float]:
    """
    Fetch street network from OpenStreetMap using OSMnx.

    Returns:
        - NetworkX graph of the street network
        - List of street segments for visualization
        - Total length in kilometers
    """
    # Create shapely polygon
    coords = [(c.lng, c.lat) for c in polygon_coords]
    polygon = Polygon(coords)

    # Fetch street network using OSMnx
    # network_type='drive' gets drivable roads
    # For walkable/cyclable streets use 'walk' or 'bike'
    try:
        G = ox.graph_from_polygon(
            polygon,
            network_type='drive',
            simplify=True,
            retain_all=False,
            truncate_by_edge=True
        )
    except Exception as e:
        logger.error(f"Failed to fetch street network: {e}")
        raise ValueError(f"Failed to fetch street network: {str(e)}")

    # Convert to undirected for visualization, but keep directed for routing
    streets = []
    total_length_m = 0
    seen_edges = set()

    for u, v, key, data in G.edges(keys=True, data=True):
        edge_id = f"{min(u, v)}-{max(u, v)}-{key}"
        if edge_id in seen_edges:
            continue
        seen_edges.add(edge_id)

        # Get street name
        name = data.get('name', None)
        if isinstance(name, list):
            name = name[0] if name else None

        # Get geometry or create from nodes
        if 'geometry' in data:
            coords_list = list(data['geometry'].coords)
        else:
            coords_list = [
                (G.nodes[u]['x'], G.nodes[u]['y']),
                (G.nodes[v]['x'], G.nodes[v]['y'])
            ]

        # Check if one-way
        oneway = data.get('oneway', False)

        # Get length
        length = data.get('length', 0)
        total_length_m += length

        street = StreetSegment(
            id=edge_id,
            name=name,
            coordinates=[Coordinate(lat=lat, lng=lng) for lng, lat in coords_list],
            oneway=oneway
        )
        streets.append(street)

    total_length_km = total_length_m / 1000

    return G, streets, total_length_km
