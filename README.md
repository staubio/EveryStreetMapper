# EveryStreet Mapper

A full-stack application for calculating optimal routes to cover every street in a selected area, minimizing overlap. Uses the Chinese Postman algorithm to find the most efficient path.

## Features

- Draw a polygon to select any area on the map
- Set a starting point for your route
- Calculate the optimal route covering all streets
- View route statistics (distance, overlap percentage, estimated time)
- Download routes as GPX files for navigation apps
- Directional arrows showing route direction

## Tech Stack

**Backend:**
- FastAPI (Python)
- OSMnx for street network data
- NetworkX for graph algorithms
- GPXpy for GPX file generation

**Frontend:**
- React with Vite
- Leaflet + react-leaflet for maps
- Turf.js for geometry calculations

## Quick Start

### Using Docker Compose (Recommended)

1. Clone the repository
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Start the application:
   ```bash
   docker compose up --build
   ```
4. Open http://localhost:3000 in your browser

### Manual Setup

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Usage

1. Use the drawing tools (polygon or rectangle) to select an area on the map
2. Keep the area under 5 km² for optimal performance
3. Click anywhere inside the selected area to set your starting point
4. Click "Calculate Route" to generate the optimal path
5. View the route statistics in the sidebar
6. Click "Download GPX" to save the route for use in navigation apps

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/streets` | Fetch streets within polygon |
| POST | `/api/route/calculate` | Calculate optimal route |
| POST | `/api/route/gpx` | Generate GPX file |
| GET | `/api/health` | Health check |

## Configuration

Environment variables (see `.env.example`):

- `OVERPASS_API_URL`: OpenStreetMap Overpass API endpoint
- `MAX_AREA_SQ_KM`: Maximum allowed area in square kilometers
- `VITE_API_URL`: Backend API URL for frontend

## Algorithm

The app uses the Chinese Postman Problem (Route Inspection Problem) algorithm:

1. Fetch the street network from OpenStreetMap
2. Build a directed graph respecting one-way streets
3. Identify vertices with unbalanced in/out degrees
4. Add duplicate edges along shortest paths to balance the graph
5. Find an Eulerian circuit through all edges
6. Convert the path to GPS coordinates

## License

MIT
