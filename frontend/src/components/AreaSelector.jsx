import React, { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-draw'

function AreaSelector({ onPolygonCreated, onPolygonDeleted }) {
  const map = useMap()
  const drawnItemsRef = useRef(null)
  const drawControlRef = useRef(null)

  useEffect(() => {
    // Initialize drawn items layer
    drawnItemsRef.current = new L.FeatureGroup()
    map.addLayer(drawnItemsRef.current)

    // Initialize draw control
    drawControlRef.current = new L.Control.Draw({
      position: 'topleft',
      draw: {
        polygon: {
          allowIntersection: false,
          drawError: {
            color: '#e1e100',
            message: '<strong>Error:</strong> Polygon cannot intersect!'
          },
          shapeOptions: {
            color: '#3388ff',
            fillOpacity: 0.2
          }
        },
        rectangle: {
          shapeOptions: {
            color: '#3388ff',
            fillOpacity: 0.2
          }
        },
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false
      },
      edit: {
        featureGroup: drawnItemsRef.current,
        remove: true
      }
    })
    map.addControl(drawControlRef.current)

    // Handle draw created event
    const handleCreated = (e) => {
      // Clear existing polygons
      drawnItemsRef.current.clearLayers()

      const layer = e.layer
      drawnItemsRef.current.addLayer(layer)

      // Get coordinates
      const coords = layer.getLatLngs()[0].map(latlng => ({
        lat: latlng.lat,
        lng: latlng.lng
      }))

      onPolygonCreated(coords)
    }

    // Handle draw deleted event
    const handleDeleted = () => {
      onPolygonDeleted()
    }

    // Handle draw edited event
    const handleEdited = (e) => {
      const layers = e.layers
      layers.eachLayer((layer) => {
        const coords = layer.getLatLngs()[0].map(latlng => ({
          lat: latlng.lat,
          lng: latlng.lng
        }))
        onPolygonCreated(coords)
      })
    }

    map.on(L.Draw.Event.CREATED, handleCreated)
    map.on(L.Draw.Event.DELETED, handleDeleted)
    map.on(L.Draw.Event.EDITED, handleEdited)

    return () => {
      map.off(L.Draw.Event.CREATED, handleCreated)
      map.off(L.Draw.Event.DELETED, handleDeleted)
      map.off(L.Draw.Event.EDITED, handleEdited)
      map.removeControl(drawControlRef.current)
      map.removeLayer(drawnItemsRef.current)
    }
  }, [map, onPolygonCreated, onPolygonDeleted])

  return null
}

export default AreaSelector
