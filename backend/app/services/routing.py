import logging
from typing import List, Tuple, Dict, Optional
from collections import defaultdict

import networkx as nx
import osmnx as ox

from app.models.schemas import Coordinate, RoutePoint

logger = logging.getLogger(__name__)


def find_nearest_node(G: nx.MultiDiGraph, point: Coordinate) -> int:
    """Find the nearest graph node to a given coordinate."""
    return ox.distance.nearest_nodes(G, point.lng, point.lat)


def chinese_postman_route(
    G: nx.MultiDiGraph, start_node: int, honor_oneways: bool = False
) -> Tuple[List[int], float, float]:
    """
    Solve the Chinese Postman Problem (Route Inspection Problem).

    The goal is to find a route that traverses every edge at least once
    with minimum total distance.

    Args:
        G: The street network graph
        start_node: Starting node ID
        honor_oneways: If True, respect one-way street directions (directed graph).
                      If False, treat all streets as two-way (undirected graph).

    Returns:
        - List of node IDs representing the route
        - Total distance in meters
        - Unique distance (original edges only) in meters
    """
    if honor_oneways:
        return _directed_chinese_postman(G, start_node)

    # Convert to undirected graph for simpler Chinese Postman
    # This treats all streets as two-way for routing purposes
    G_undirected = G.to_undirected()

    # Remove very short intersection segments (< 15m) to avoid unnecessary backtracking
    INTERSECTION_TOLERANCE_M = 15
    edges_to_remove = [
        (u, v, k) for u, v, k, data in G_undirected.edges(keys=True, data=True)
        if data.get('length', 0) < INTERSECTION_TOLERANCE_M
    ]
    for u, v, k in edges_to_remove:
        if G_undirected.has_edge(u, v, k):
            G_undirected.remove_edge(u, v, k)

    # Ensure graph is connected
    if not nx.is_connected(G_undirected):
        # Get the largest connected component
        largest_cc = max(nx.connected_components(G_undirected), key=len)
        G_undirected = G_undirected.subgraph(largest_cc).copy()

        # Check if start node is in the component
        if start_node not in G_undirected.nodes():
            # Find nearest node in the component
            start_node = min(
                G_undirected.nodes(),
                key=lambda n: (
                    (G_undirected.nodes[n]['x'] - G.nodes[start_node]['x'])**2 +
                    (G_undirected.nodes[n]['y'] - G.nodes[start_node]['y'])**2
                )
            )

    # Calculate unique distance (original edges)
    unique_distance = sum(data.get('length', 0) for _, _, data in G_undirected.edges(data=True))

    # Find nodes with odd degree
    odd_degree_nodes = [node for node in G_undirected.nodes() if G_undirected.degree(node) % 2 == 1]

    logger.info(f"Graph has {len(G_undirected.nodes())} nodes, {len(G_undirected.edges())} edges, {len(odd_degree_nodes)} odd-degree nodes")

    # If there are odd-degree nodes, we need to add edges to make them even
    G_augmented = nx.MultiGraph(G_undirected)

    if odd_degree_nodes:
        # Use greedy matching for speed (pair nearest odd-degree nodes)
        remaining = set(odd_degree_nodes)
        matched_pairs = []

        while len(remaining) >= 2:
            # Pick first remaining node
            u = next(iter(remaining))
            remaining.remove(u)

            # Find nearest remaining node using graph distance
            best_v = None
            best_dist = float('inf')

            for v in remaining:
                try:
                    dist = nx.shortest_path_length(G_undirected, u, v, weight='length')
                    if dist < best_dist:
                        best_dist = dist
                        best_v = v
                except nx.NetworkXNoPath:
                    continue

            if best_v is not None:
                remaining.remove(best_v)
                matched_pairs.append((u, best_v))

        # Add edges along shortest paths for each matched pair
        for u, v in matched_pairs:
            try:
                path = nx.shortest_path(G_undirected, u, v, weight='length')
                for j in range(len(path) - 1):
                    edge_data = G_undirected.get_edge_data(path[j], path[j+1])
                    if edge_data:
                        first_key = list(edge_data.keys())[0]
                        G_augmented.add_edge(path[j], path[j+1], **edge_data[first_key])
            except nx.NetworkXNoPath:
                pass

    # Now find Eulerian path (not circuit - don't return to start)
    try:
        euler_circuit = list(nx.eulerian_circuit(G_augmented, source=start_node))
        route = [start_node] + [v for _, v in euler_circuit]

        # Remove the final return to start - we want a path, not a circuit
        # The route currently ends at start_node; remove it to end elsewhere
        if len(route) > 1 and route[-1] == start_node:
            route = route[:-1]

        logger.info(f"Found Eulerian path with {len(route)} nodes")
    except nx.NetworkXError as e:
        logger.warning(f"No Eulerian circuit found: {e}, using edge-based traversal")
        # Fallback: traverse all edges using DFS
        route = _dfs_edge_traversal(G_augmented, start_node)
        # Also remove return to start for DFS traversal
        if len(route) > 1 and route[-1] == start_node:
            route = route[:-1]

    # Calculate total distance
    total_distance = 0
    G_for_lookup = nx.MultiGraph(G_undirected)  # Use original for geometry lookup
    for i in range(len(route) - 1):
        u, v = route[i], route[i + 1]
        if G_for_lookup.has_edge(u, v):
            edge_data = G_for_lookup.get_edge_data(u, v)
            if edge_data:
                min_length = min(d.get('length', 0) for d in edge_data.values())
                total_distance += min_length

    return route, total_distance, unique_distance


def _dfs_edge_traversal(G: nx.MultiGraph, start_node: int) -> List[int]:
    """Traverse all edges using DFS, returning to start."""
    visited_edges = set()
    route = [start_node]
    stack = [(start_node, list(G.edges(start_node, keys=True)))]

    while stack:
        node, edges = stack[-1]

        # Find an unvisited edge
        found = False
        while edges:
            edge = edges.pop(0)
            u, v, key = edge
            edge_id = (min(u, v), max(u, v), key)

            if edge_id not in visited_edges:
                visited_edges.add(edge_id)
                next_node = v if v != node else u
                route.append(next_node)
                stack.append((next_node, list(G.edges(next_node, keys=True))))
                found = True
                break

        if not found:
            stack.pop()
            if stack:
                # Backtrack
                route.append(stack[-1][0])

    return route


def _directed_chinese_postman(G: nx.MultiDiGraph, start_node: int) -> Tuple[List[int], float, float]:
    """
    Solve the Chinese Postman Problem while respecting one-way streets.

    Key insight: Two-way streets have edges in both directions in the graph,
    but we only need to traverse the street ONCE. One-way streets only have
    one edge and must be traveled in that direction.

    Approach:
    1. Identify "required" edges - for two-way streets, only one direction is required
    2. Build a graph with required edges plus connecting edges for traversal
    3. Find a route covering all required edges

    Returns:
        - List of node IDs representing the route
        - Total distance in meters
        - Unique distance (original edges only) in meters
    """
    # Step 1: Identify required edges (avoiding double-counting two-way streets)
    required_edges = set()  # (u, v, key) tuples
    seen_streets = set()  # canonical (min_node, max_node) for two-way streets

    # Intersection tolerance: segments shorter than this are considered part of
    # the intersection and don't require explicit traversal
    INTERSECTION_TOLERANCE_M = 15  # meters

    for u, v, key, data in G.edges(keys=True, data=True):
        length = data.get('length', 0)

        # Skip very short segments (intersection fragments)
        if length < INTERSECTION_TOLERANCE_M:
            continue

        is_oneway = data.get('oneway', False)

        if is_oneway:
            # One-way: this edge is required in this direction
            required_edges.add((u, v, key))
        else:
            # Two-way: only require one direction (use canonical form)
            canonical = (min(u, v), max(u, v))
            if canonical not in seen_streets:
                seen_streets.add(canonical)
                required_edges.add((u, v, key))

    # Calculate unique distance from required edges
    unique_distance = sum(
        G.edges[u, v, k].get('length', 0) for u, v, k in required_edges
    )

    logger.info(f"Directed routing: {len(G.edges())} total edges, {len(required_edges)} required edges, unique dist: {unique_distance:.0f}m")

    # Step 2: Ensure graph connectivity (use weakly connected - don't drop nodes)
    # We use weakly connected because strongly connected would drop nodes that
    # are reachable but not in a cycle, missing edge streets
    if not nx.is_weakly_connected(G):
        largest_cc = max(nx.weakly_connected_components(G), key=len)
        logger.info(f"Using largest weakly connected component: {len(largest_cc)}/{len(G.nodes())} nodes")
        G = G.subgraph(largest_cc).copy()

        # Filter required edges to those still in the graph
        required_edges = {(u, v, k) for u, v, k in required_edges
                         if u in G.nodes() and v in G.nodes() and G.has_edge(u, v)}
        unique_distance = sum(G.edges[u, v, k].get('length', 0) for u, v, k in required_edges)

    if start_node not in G.nodes():
        original_start = start_node
        start_node = min(
            G.nodes(),
            key=lambda n: (
                (G.nodes[n]['x'] - G.nodes[original_start]['x'])**2 +
                (G.nodes[n]['y'] - G.nodes[original_start]['y'])**2
            )
        )
        logger.info(f"Start node not in component, using nearest: {start_node}")

    # Step 3: Build a graph with only required edges, then find route
    # We'll use a greedy approach: traverse required edges, using any valid edge for connections
    route = _traverse_required_edges(G, start_node, required_edges)

    # Calculate total distance
    total_distance = 0
    for i in range(len(route) - 1):
        u, v = route[i], route[i + 1]
        if G.has_edge(u, v):
            edge_data = G.get_edge_data(u, v)
            if edge_data:
                min_length = min(d.get('length', 0) for d in edge_data.values())
                total_distance += min_length

    logger.info(f"Route complete: {len(route)} nodes, total dist: {total_distance:.0f}m, unique: {unique_distance:.0f}m")

    return route, total_distance, unique_distance


def _traverse_required_edges(
    G: nx.MultiDiGraph, start_node: int, required_edges: set
) -> List[int]:
    """
    Find a route that traverses all required edges while respecting one-way constraints.

    Uses greedy approach: from current node, prefer unvisited required edges,
    otherwise take shortest path to nearest node with unvisited required edges.
    Falls back to undirected paths if no directed path exists.
    """
    remaining = set(required_edges)
    route = [start_node]
    current = start_node

    # Create undirected version for fallback pathfinding
    G_undirected = G.to_undirected()

    # Build index: node -> outgoing required edges from that node
    required_from = defaultdict(set)
    for u, v, k in required_edges:
        required_from[u].add((u, v, k))

    # Also allow traversing required edges from either end (for two-way streets)
    # This helps when approaching from the "wrong" direction
    required_at_node = defaultdict(set)
    for u, v, k in required_edges:
        required_at_node[u].add((u, v, k))
        required_at_node[v].add((u, v, k))

    max_iterations = len(G.edges()) * 5
    iterations = 0

    while remaining and iterations < max_iterations:
        iterations += 1

        # Check for required edges from current node (outgoing)
        available = [(u, v, k) for u, v, k in required_from[current] if (u, v, k) in remaining]

        if available:
            # Take a required edge
            u, v, k = available[0]
            remaining.discard((u, v, k))
            route.append(v)
            current = v
        else:
            # No required edges from here - find path to nearest node with required edges
            nodes_with_required = {u for u, v, k in remaining}

            if not nodes_with_required:
                break

            # Find nearest reachable node with required edges
            best_path = None
            best_length = float('inf')

            for target in nodes_with_required:
                # Try directed path first
                try:
                    path = nx.shortest_path(G, current, target, weight='length')
                    length = sum(
                        min(d.get('length', 0) for d in G.get_edge_data(path[i], path[i+1]).values())
                        for i in range(len(path) - 1)
                    )
                    if length < best_length:
                        best_length = length
                        best_path = path
                except nx.NetworkXNoPath:
                    pass

            # If no directed path found, try undirected (allows "walking" to unreachable areas)
            if best_path is None:
                for target in nodes_with_required:
                    try:
                        path = nx.shortest_path(G_undirected, current, target, weight='length')
                        length = sum(
                            min(d.get('length', 0) for d in G_undirected.get_edge_data(path[i], path[i+1]).values())
                            for i in range(len(path) - 1)
                        )
                        # Add penalty for undirected path (prefer directed)
                        if length < best_length:
                            best_length = length
                            best_path = path
                    except nx.NetworkXNoPath:
                        continue

            if best_path is None:
                logger.warning(f"Cannot reach remaining required edges from node {current}")
                break

            # Add path (excluding current node which is already in route)
            route.extend(best_path[1:])
            current = best_path[-1]

    if remaining:
        logger.warning(f"Could not traverse {len(remaining)} required edges")

    return route


def _dfs_directed_edge_traversal(G: nx.MultiDiGraph, start_node: int) -> List[int]:
    """
    Traverse all edges in a directed graph using Hierholzer's algorithm variant.

    This is a fallback when the standard Eulerian path finding fails.
    """
    visited_edges = set()
    route = [start_node]
    current = start_node
    max_iterations = len(G.edges()) * 3  # Safety limit
    iterations = 0

    while iterations < max_iterations:
        iterations += 1

        # Find an unvisited outgoing edge from current node
        found_edge = None
        for u, v, key in G.out_edges(current, keys=True):
            edge_id = (u, v, key)
            if edge_id not in visited_edges:
                found_edge = (u, v, key)
                break

        if found_edge:
            u, v, key = found_edge
            visited_edges.add((u, v, key))
            route.append(v)
            current = v
        else:
            # No unvisited edges from current node
            # Check if we've visited all edges
            if len(visited_edges) >= len(G.edges()):
                break

            # Try to find a node in the route that has unvisited edges
            found_restart = False
            for i, node in enumerate(route):
                for u, v, key in G.out_edges(node, keys=True):
                    if (u, v, key) not in visited_edges:
                        # Found unvisited edge, but need to get there
                        # For simplicity, just continue from here
                        current = node
                        found_restart = True
                        break
                if found_restart:
                    break

            if not found_restart:
                # No more edges to visit
                break

    logger.info(f"DFS traversal completed: {len(visited_edges)}/{len(G.edges())} edges visited")
    return route


def balance_graph(G: nx.MultiDiGraph, unbalanced: List[Tuple[int, int]]) -> nx.MultiDiGraph:
    """
    Balance the graph by adding edges along shortest paths
    to make it Eulerian.

    For each node: imbalance = in_degree - out_degree
    - Negative imbalance (diff < 0): has excess outgoing, needs more incoming
    - Positive imbalance (diff > 0): has excess incoming, needs more outgoing

    To balance, we add paths FROM positive nodes TO negative nodes.
    This gives positive nodes +1 outgoing and negative nodes +1 incoming.
    """
    # Create a dict tracking imbalance
    imbalance = {node: diff for node, diff in unbalanced}

    # Create copy for modification
    G_balanced = G.copy()

    # Nodes with excess outgoing (need incoming) - these are path DESTINATIONS
    need_incoming = [node for node, diff in unbalanced if diff < 0]
    # Nodes with excess incoming (need outgoing) - these are path SOURCES
    need_outgoing = [node for node, diff in unbalanced if diff > 0]

    if not need_incoming or not need_outgoing:
        return G_balanced

    logger.info(f"Balancing graph: {len(need_outgoing)} need outgoing, {len(need_incoming)} need incoming")

    # Cache for shortest paths (computed lazily)
    path_cache = {}

    def get_path(from_node, to_node):
        """Get shortest path, using cache."""
        if (from_node, to_node) not in path_cache:
            try:
                path_cache[(from_node, to_node)] = nx.shortest_path(G, from_node, to_node, weight='length')
            except nx.NetworkXNoPath:
                path_cache[(from_node, to_node)] = None
        return path_cache[(from_node, to_node)]

    def get_path_length(from_node, to_node):
        """Get path length from cached path."""
        path = get_path(from_node, to_node)
        if path is None:
            return float('inf')
        length = 0
        for i in range(len(path) - 1):
            edge_data = G.get_edge_data(path[i], path[i + 1])
            if edge_data:
                length += min(d.get('length', 0) for d in edge_data.values())
        return length

    # Greedy matching: repeatedly pair nearest nodes
    iterations = 0
    max_iterations = sum(abs(d) for d in imbalance.values()) // 2 + 1

    while iterations < max_iterations:
        iterations += 1

        # Find nodes that still need balancing
        active_sources = [n for n in need_outgoing if imbalance.get(n, 0) > 0]  # still have excess incoming
        active_dests = [n for n in need_incoming if imbalance.get(n, 0) < 0]    # still have excess outgoing

        if not active_sources or not active_dests:
            break

        # Find the nearest pair (path from source to dest)
        best_pair = None
        best_dist = float('inf')

        for src in active_sources:
            for dst in active_dests:
                dist = get_path_length(src, dst)
                if dist < best_dist:
                    best_dist = dist
                    best_pair = (src, dst)

        if best_pair is None or best_dist == float('inf'):
            logger.warning("Could not find path between remaining unbalanced nodes")
            break

        src, dst = best_pair
        path = get_path(src, dst)

        # Add edges along the path
        for i in range(len(path) - 1):
            u, v = path[i], path[i + 1]
            edge_data = G.get_edge_data(u, v)
            if edge_data:
                first_key = list(edge_data.keys())[0]
                G_balanced.add_edge(u, v, **edge_data[first_key])

        # Update imbalances:
        # src gets +1 outgoing, so in-out decreases by 1
        # dst gets +1 incoming, so in-out increases by 1
        imbalance[src] = imbalance.get(src, 0) - 1
        imbalance[dst] = imbalance.get(dst, 0) + 1

    return G_balanced


def route_to_coordinates(G: nx.MultiDiGraph, route: List[int]) -> List[RoutePoint]:
    """Convert a route of node IDs to coordinates, including edge geometries."""
    points = []

    for i in range(len(route) - 1):
        u, v = route[i], route[i + 1]

        # Try to get edge data (check both directions for undirected traversal)
        edge_data = G.get_edge_data(u, v)
        reverse = False
        if not edge_data:
            edge_data = G.get_edge_data(v, u)
            reverse = True

        # Get street name and geometry
        street_name = None
        geom = None

        if edge_data:
            first_edge = list(edge_data.values())[0]
            name = first_edge.get('name', None)
            if isinstance(name, list):
                name = name[0] if name else None
            street_name = name
            geom = first_edge.get('geometry', None)

        if geom:
            coords = list(geom.coords)

            # Check if we need to reverse the geometry based on direction
            start_node = G.nodes[u]
            first_coord = coords[0]
            dist_to_start = (first_coord[0] - start_node['x'])**2 + (first_coord[1] - start_node['y'])**2
            last_coord = coords[-1]
            dist_to_start_reversed = (last_coord[0] - start_node['x'])**2 + (last_coord[1] - start_node['y'])**2

            if dist_to_start_reversed < dist_to_start:
                coords = coords[::-1]

            # Add all points from geometry (except last, which is next node)
            for lng, lat in coords[:-1]:
                points.append(RoutePoint(lat=lat, lng=lng, street_name=street_name))
        else:
            # No geometry, just add the start node
            node_data = G.nodes[u]
            points.append(RoutePoint(
                lat=node_data['y'],
                lng=node_data['x'],
                street_name=street_name
            ))

    # Add the final node
    if route:
        final_node = G.nodes[route[-1]]
        points.append(RoutePoint(
            lat=final_node['y'],
            lng=final_node['x'],
            street_name=None
        ))

    return points


def calculate_route(
    G: nx.MultiDiGraph,
    start_point: Coordinate,
    honor_oneways: bool = False
) -> Tuple[List[RoutePoint], float, float, float]:
    """
    Calculate the optimal route covering all streets.

    Args:
        G: The street network graph
        start_point: Starting coordinate
        honor_oneways: If True, respect one-way street directions.
                      If False, treat all streets as two-way.

    Returns:
        - List of route points with coordinates
        - Total distance in km
        - Unique distance in km
        - Overlap percentage
    """
    # Find nearest node to start point
    start_node = find_nearest_node(G, start_point)

    # Solve Chinese Postman Problem
    route_nodes, total_distance_m, unique_distance_m = chinese_postman_route(
        G, start_node, honor_oneways=honor_oneways
    )

    # Convert to coordinates
    route_points = route_to_coordinates(G, route_nodes)

    # Calculate statistics
    total_distance_km = total_distance_m / 1000
    unique_distance_km = unique_distance_m / 1000
    overlap_percentage = ((total_distance_m - unique_distance_m) / unique_distance_m * 100) if unique_distance_m > 0 else 0

    return route_points, total_distance_km, unique_distance_km, overlap_percentage
