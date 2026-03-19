import React, { useRef, useEffect } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import AreaSelector from './AreaSelector'
import RouteDisplay from './RouteDisplay'
import SearchBox from './SearchBox'
import L from 'leaflet'

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Custom start point icon
const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

function StartPointMarker({ startPoint, onStartPointSet, polygon }) {
  const map = useMap()
  const markerRef = useRef(null)

  useMapEvents({
    click(e) {
      if (polygon) {
        onStartPointSet({ lat: e.latlng.lat, lng: e.latlng.lng })
      }
    }
  })

  useEffect(() => {
    if (startPoint) {
      if (markerRef.current) {
        markerRef.current.setLatLng([startPoint.lat, startPoint.lng])
      } else {
        markerRef.current = L.marker([startPoint.lat, startPoint.lng], { icon: startIcon })
          .addTo(map)
          .bindPopup('Start Point')
      }
    } else if (markerRef.current) {
      map.removeLayer(markerRef.current)
      markerRef.current = null
    }

    return () => {
      if (markerRef.current) {
        map.removeLayer(markerRef.current)
        markerRef.current = null
      }
    }
  }, [startPoint, map])

  return null
}

function Map({
  polygon,
  startPoint,
  route,
  streets,
  onPolygonCreated,
  onPolygonDeleted,
  onStartPointSet
}) {
  const defaultCenter = [40.7128, -74.0060] // New York City
  const defaultZoom = 13

  return (
    <div className="map-container">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <SearchBox />
        <AreaSelector
          onPolygonCreated={onPolygonCreated}
          onPolygonDeleted={onPolygonDeleted}
        />
        <StartPointMarker
          startPoint={startPoint}
          onStartPointSet={onStartPointSet}
          polygon={polygon}
        />
        <RouteDisplay route={route} streets={streets} />
      </MapContainer>
    </div>
  )
}

export default Map
