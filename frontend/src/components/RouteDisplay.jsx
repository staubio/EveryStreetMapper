import React, { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

function RouteDisplay({ route, streets }) {
  const map = useMap()
  const routeLayerRef = useRef(null)
  const streetsLayerRef = useRef(null)

  // Display streets (background)
  useEffect(() => {
    if (streetsLayerRef.current) {
      map.removeLayer(streetsLayerRef.current)
      streetsLayerRef.current = null
    }

    if (streets && streets.length > 0) {
      const streetLines = streets.map(street => {
        const coords = street.coordinates.map(c => [c.lat, c.lng])
        return L.polyline(coords, {
          color: '#ddd',
          weight: 6,
          opacity: 0.4
        })
      })

      streetsLayerRef.current = L.featureGroup(streetLines)
      streetsLayerRef.current.addTo(map)
    }

    return () => {
      if (streetsLayerRef.current) {
        map.removeLayer(streetsLayerRef.current)
      }
    }
  }, [streets, map])

  // Display route with lane-style offset and proper corner joins
  useEffect(() => {
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current)
      routeLayerRef.current = null
    }

    if (route && route.length > 1) {
      const routeGroup = L.featureGroup()
      const offsetDistance = 0.00004 // ~4 meters

      // Calculate offset route with proper miter joins
      const offsetPoints = calculateOffsetRoute(route, offsetDistance)

      // Draw gradient colored segments in REVERSE order
      // This makes earlier segments (green) appear on top of later ones (red)
      // Segments that overlap previously-drawn areas are dashed to show layers

      // Track drawn segments for overlap detection
      const drawnSegments = []
      const overlapThreshold = 0.00003 // ~3 meters - segments closer than this are "overlapping"

      // Helper to check if a segment overlaps any previously drawn segment
      const checkOverlap = (p1, p2) => {
        for (const drawn of drawnSegments) {
          // Check if midpoints are close (simple overlap detection)
          const mid1 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2]
          const mid2 = [(drawn.p1[0] + drawn.p2[0]) / 2, (drawn.p1[1] + drawn.p2[1]) / 2]

          const dist = Math.sqrt(
            Math.pow(mid1[0] - mid2[0], 2) +
            Math.pow((mid1[1] - mid2[1]) * Math.cos(mid1[0] * Math.PI / 180), 2)
          )

          if (dist < overlapThreshold) {
            return true
          }
        }
        return false
      }

      for (let i = offsetPoints.length - 2; i >= 0; i--) {
        const progress = i / (offsetPoints.length - 1)
        const color = getProgressColor(progress)
        const p1 = offsetPoints[i]
        const p2 = offsetPoints[i + 1]

        // Check if this segment overlaps a previously drawn one
        const isOverlap = checkOverlap(p1, p2)

        // For overlapping segments, use dashes with gaps so underlying color shows through
        // Dash pattern: 6px dash, 8px gap - bigger gaps to reveal more of what's beneath
        const segment = L.polyline(
          [p1, p2],
          {
            color: color,
            weight: 4,
            opacity: 0.95,
            lineCap: 'butt',  // Flat ends for cleaner dash edges
            lineJoin: 'round',
            dashArray: isOverlap ? '6, 8' : null
          }
        )
        routeGroup.addLayer(segment)

        // Track this segment
        drawnSegments.push({ p1, p2 })
      }

      // Add direction chevrons along the route
      // Place at regular intervals AND after every turn
      const arrowInterval = Math.max(3, Math.floor(route.length / 60))
      const arrowSize = 0.00004
      const turnThreshold = 30 // degrees - what counts as a "turn"

      // Build set of indices where chevrons should appear
      const chevronIndices = new Set()

      // Add regular interval chevrons
      for (let i = arrowInterval; i < route.length - 1; i += arrowInterval) {
        chevronIndices.add(i)
      }

      // Add chevrons after turns
      for (let i = 1; i < route.length - 1; i++) {
        const prev = route[i - 1]
        const curr = route[i]
        const next = route[i + 1]

        const bearingIn = calculateBearing(prev.lat, prev.lng, curr.lat, curr.lng)
        const bearingOut = calculateBearing(curr.lat, curr.lng, next.lat, next.lng)

        let turnAngle = Math.abs(bearingOut - bearingIn)
        if (turnAngle > 180) turnAngle = 360 - turnAngle

        // If this is a turn, add chevron shortly after
        if (turnAngle >= turnThreshold && i + 2 < route.length) {
          chevronIndices.add(i + 2) // Place chevron 2 points after the turn
        }
      }

      // Draw chevrons at all identified positions
      for (const i of chevronIndices) {
        if (i >= route.length - 1) continue

        const curr = route[i]
        const next = route[i + 1]
        const progress = i / (route.length - 1)

        const bearing = calculateBearing(curr.lat, curr.lng, next.lat, next.lng)
        const bearingRad = bearing * Math.PI / 180
        const perpBearing = (bearing + 90) * Math.PI / 180
        const cosLat = Math.cos(curr.lat * Math.PI / 180)

        // Offset the chevron position to match the route line
        const chevronLat = curr.lat + Math.cos(perpBearing) * offsetDistance
        const chevronLng = curr.lng + Math.sin(perpBearing) * offsetDistance / cosLat

        const backAngle = Math.PI * 0.8
        const leftPoint = [
          chevronLat + Math.cos(bearingRad + backAngle) * arrowSize,
          chevronLng + Math.sin(bearingRad + backAngle) * arrowSize / cosLat
        ]
        const rightPoint = [
          chevronLat + Math.cos(bearingRad - backAngle) * arrowSize,
          chevronLng + Math.sin(bearingRad - backAngle) * arrowSize / cosLat
        ]

        // Color chevron to match the route line at this point
        const chevronColor = getProgressColor(progress)

        const chevron = L.polyline(
          [leftPoint, [chevronLat, chevronLng], rightPoint],
          {
            color: chevronColor,
            weight: 2,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round'
          }
        )
        routeGroup.addLayer(chevron)
      }

      // Add small turn indicators at each turn point
      // Simple dot with short directional tick showing outgoing direction
      const tickLength = 0.000035 // ~3.5 meters
      for (let i = 1; i < route.length - 1; i++) {
        const prev = route[i - 1]
        const curr = route[i]
        const next = route[i + 1]

        const bearingIn = calculateBearing(prev.lat, prev.lng, curr.lat, curr.lng)
        const bearingOut = calculateBearing(curr.lat, curr.lng, next.lat, next.lng)

        let turnAngle = bearingOut - bearingIn
        while (turnAngle > 180) turnAngle -= 360
        while (turnAngle < -180) turnAngle += 360

        // Only add indicator for significant turns (> 30 degrees)
        if (Math.abs(turnAngle) < 30) continue

        const progress = i / (route.length - 1)
        const turnColor = getProgressColor(progress)
        const cosLat = Math.cos(curr.lat * Math.PI / 180)

        // Offset to match route line position
        const perpIn = (bearingIn + 90) * Math.PI / 180
        const dotLat = curr.lat + Math.cos(perpIn) * offsetDistance
        const dotLng = curr.lng + Math.sin(perpIn) * offsetDistance / cosLat

        // Small dot at turn point
        const turnDot = L.circleMarker([dotLat, dotLng], {
          radius: 4,
          fillColor: turnColor,
          fillOpacity: 1,
          color: 'white',
          weight: 1.5,
          opacity: 1
        })
        routeGroup.addLayer(turnDot)

        // Short tick pointing in outgoing direction
        const outRad = bearingOut * Math.PI / 180
        const tickEnd = [
          dotLat + Math.cos(outRad) * tickLength,
          dotLng + Math.sin(outRad) * tickLength / cosLat
        ]

        const tick = L.polyline(
          [[dotLat, dotLng], tickEnd],
          {
            color: turnColor,
            weight: 3,
            opacity: 1,
            lineCap: 'round'
          }
        )
        routeGroup.addLayer(tick)
      }

      // Add start marker
      const startIcon = L.divIcon({
        className: 'start-marker',
        html: `<div style="
          background: #27ae60;
          color: white;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: bold;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.5);
        ">S</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })
      const startMarker = L.marker([route[0].lat, route[0].lng], {
        icon: startIcon,
        zIndexOffset: 1000
      })
      startMarker.bindPopup('Start')
      routeGroup.addLayer(startMarker)

      // Add end marker
      const endIcon = L.divIcon({
        className: 'end-marker',
        html: `<div style="
          background: #c0392b;
          color: white;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: bold;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.5);
        ">E</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })
      const endMarker = L.marker([route[route.length - 1].lat, route[route.length - 1].lng], {
        icon: endIcon,
        zIndexOffset: 1000
      })
      endMarker.bindPopup('End')
      routeGroup.addLayer(endMarker)

      routeLayerRef.current = routeGroup
      routeLayerRef.current.addTo(map)

      // Fit map to route bounds
      const coords = route.map(p => [p.lat, p.lng])
      const bounds = L.latLngBounds(coords)
      map.fitBounds(bounds, { padding: [50, 50] })
    }

    return () => {
      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current)
      }
    }
  }, [route, map])

  return null
}

// Calculate offset route with rounded corners at sharp turns
// Simplify route by merging points that are very close together
// This collapses multiple small turns within an intersection into a single turn
function simplifyRoute(route, tolerance) {
  if (route.length < 3) return route

  const simplified = [route[0]]

  for (let i = 1; i < route.length - 1; i++) {
    const prev = simplified[simplified.length - 1]
    const curr = route[i]

    // Calculate distance from previous kept point
    const dist = Math.sqrt(
      Math.pow(curr.lat - prev.lat, 2) +
      Math.pow((curr.lng - prev.lng) * Math.cos(curr.lat * Math.PI / 180), 2)
    )

    // Keep point if it's far enough from the last kept point
    // OR if there's a significant direction change
    if (dist >= tolerance) {
      simplified.push(curr)
    } else {
      // Check if this is a significant turn that should be kept
      const next = route[i + 1]
      if (next) {
        const bearingIn = calculateBearing(prev.lat, prev.lng, curr.lat, curr.lng)
        const bearingOut = calculateBearing(curr.lat, curr.lng, next.lat, next.lng)
        let turnAngle = Math.abs(bearingOut - bearingIn)
        if (turnAngle > 180) turnAngle = 360 - turnAngle

        // Keep the point if it's a sharp turn (> 60 degrees)
        if (turnAngle > 60) {
          simplified.push(curr)
        }
      }
    }
  }

  // Always keep the last point
  simplified.push(route[route.length - 1])

  return simplified
}

function calculateOffsetRouteWithRoundedCorners(route, offsetDistance) {
  const result = []
  const turnThreshold = 25 // degrees - use rounded corner for turns sharper than this

  // First, simplify the route by merging points that are very close together
  // This prevents multiple small turns within an intersection from creating chaos
  const simplifiedRoute = simplifyRoute(route, 0.00025) // ~25 meter tolerance

  for (let i = 0; i < simplifiedRoute.length; i++) {
    const curr = simplifiedRoute[i]
    const cosLat = Math.cos(curr.lat * Math.PI / 180)

    if (i === 0) {
      // First point
      const next = simplifiedRoute[1]
      const bearing = calculateBearing(curr.lat, curr.lng, next.lat, next.lng)
      const perpBearing = (bearing + 90) * Math.PI / 180
      result.push([
        curr.lat + Math.cos(perpBearing) * offsetDistance,
        curr.lng + Math.sin(perpBearing) * offsetDistance / cosLat
      ])
    } else if (i === simplifiedRoute.length - 1) {
      // Last point
      const prev = simplifiedRoute[i - 1]
      const bearing = calculateBearing(prev.lat, prev.lng, curr.lat, curr.lng)
      const perpBearing = (bearing + 90) * Math.PI / 180
      result.push([
        curr.lat + Math.cos(perpBearing) * offsetDistance,
        curr.lng + Math.sin(perpBearing) * offsetDistance / cosLat
      ])
    } else {
      // Middle point - check for sharp turn
      const prev = simplifiedRoute[i - 1]
      const next = simplifiedRoute[i + 1]

      const bearingIn = calculateBearing(prev.lat, prev.lng, curr.lat, curr.lng)
      const bearingOut = calculateBearing(curr.lat, curr.lng, next.lat, next.lng)

      let turnAngle = bearingOut - bearingIn
      while (turnAngle > 180) turnAngle -= 360
      while (turnAngle < -180) turnAngle += 360

      if (Math.abs(turnAngle) >= turnThreshold) {
        // Sharp turn: add rounded corner (arc of points)
        const perpIn = (bearingIn + 90) * Math.PI / 180
        const perpOut = (bearingOut + 90) * Math.PI / 180

        // Starting point of arc (along incoming perpendicular)
        const arcStart = [
          curr.lat + Math.cos(perpIn) * offsetDistance,
          curr.lng + Math.sin(perpIn) * offsetDistance / cosLat
        ]

        // Ending point of arc (along outgoing perpendicular)
        const arcEnd = [
          curr.lat + Math.cos(perpOut) * offsetDistance,
          curr.lng + Math.sin(perpOut) * offsetDistance / cosLat
        ]

        // Number of arc segments based on turn sharpness
        const numArcPoints = Math.max(2, Math.ceil(Math.abs(turnAngle) / 15))

        // Generate arc points
        for (let j = 0; j <= numArcPoints; j++) {
          const t = j / numArcPoints
          const angle = perpIn + (perpOut - perpIn) * t

          // Handle angle wrapping
          let angleDiff = perpOut - perpIn
          while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI
          while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI
          const interpAngle = perpIn + angleDiff * t

          result.push([
            curr.lat + Math.cos(interpAngle) * offsetDistance,
            curr.lng + Math.sin(interpAngle) * offsetDistance / cosLat
          ])
        }
      } else {
        // Gentle curve: use simple perpendicular offset
        const perpAngle = (bearingIn + 90) * Math.PI / 180
        result.push([
          curr.lat + Math.cos(perpAngle) * offsetDistance,
          curr.lng + Math.sin(perpAngle) * offsetDistance / cosLat
        ])
      }
    }
  }

  return result
}

// Calculate offset route with proper miter joins at corners (legacy)
function calculateOffsetRoute(route, offsetDistance) {
  const offsetPoints = []

  for (let i = 0; i < route.length; i++) {
    const curr = route[i]
    const cosLat = Math.cos(curr.lat * Math.PI / 180)

    if (i === 0) {
      // First point: offset perpendicular to direction to next point
      const next = route[1]
      const bearing = calculateBearing(curr.lat, curr.lng, next.lat, next.lng)
      const perpBearing = (bearing + 90) * Math.PI / 180

      offsetPoints.push([
        curr.lat + Math.cos(perpBearing) * offsetDistance,
        curr.lng + Math.sin(perpBearing) * offsetDistance / cosLat
      ])
    } else if (i === route.length - 1) {
      // Last point: offset perpendicular to direction from previous point
      const prev = route[i - 1]
      const bearing = calculateBearing(prev.lat, prev.lng, curr.lat, curr.lng)
      const perpBearing = (bearing + 90) * Math.PI / 180

      offsetPoints.push([
        curr.lat + Math.cos(perpBearing) * offsetDistance,
        curr.lng + Math.sin(perpBearing) * offsetDistance / cosLat
      ])
    } else {
      // Middle point: calculate miter join
      const prev = route[i - 1]
      const next = route[i + 1]

      const bearingIn = calculateBearing(prev.lat, prev.lng, curr.lat, curr.lng)
      const bearingOut = calculateBearing(curr.lat, curr.lng, next.lat, next.lng)

      // Calculate the turn angle (normalized to -180 to 180)
      let turnAngle = bearingOut - bearingIn
      while (turnAngle > 180) turnAngle -= 360
      while (turnAngle < -180) turnAngle += 360

      // For nearly straight segments, just use perpendicular to incoming direction
      if (Math.abs(turnAngle) < 1) {
        const perpAngle = (bearingIn + 90) * Math.PI / 180
        offsetPoints.push([
          curr.lat + Math.cos(perpAngle) * offsetDistance,
          curr.lng + Math.sin(perpAngle) * offsetDistance / cosLat
        ])
        continue
      }

      // Calculate the angle bisector properly (handles angle wrapping)
      // The bisector direction is the average of the incoming and outgoing perpendiculars
      const perpIn = (bearingIn + 90) * Math.PI / 180
      const perpOut = (bearingOut + 90) * Math.PI / 180

      // Average the perpendicular vectors
      const avgX = (Math.cos(perpIn) + Math.cos(perpOut)) / 2
      const avgY = (Math.sin(perpIn) + Math.sin(perpOut)) / 2

      // Normalize and scale
      const length = Math.sqrt(avgX * avgX + avgY * avgY)

      if (length < 0.001) {
        // Near U-turn: just use incoming perpendicular
        const perpAngle = (bearingIn + 90) * Math.PI / 180
        offsetPoints.push([
          curr.lat + Math.cos(perpAngle) * offsetDistance,
          curr.lng + Math.sin(perpAngle) * offsetDistance / cosLat
        ])
        continue
      }

      // Calculate miter factor to maintain consistent lane width
      // The miter extends further at sharper turns
      const halfTurnRad = Math.abs(turnAngle) * Math.PI / 360
      const miterFactor = 1 / Math.cos(halfTurnRad)

      // Cap the miter to avoid extreme spikes at very sharp turns
      const cappedMiter = Math.min(miterFactor, 2.5)
      const adjustedOffset = offsetDistance * cappedMiter

      // Apply offset in the averaged perpendicular direction
      const normX = avgX / length
      const normY = avgY / length

      offsetPoints.push([
        curr.lat + normX * adjustedOffset,
        curr.lng + normY * adjustedOffset / cosLat
      ])
    }
  }

  return offsetPoints
}

// Calculate bearing between two points (in degrees)
function calculateBearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180
  const lat1Rad = lat1 * Math.PI / 180
  const lat2Rad = lat2 * Math.PI / 180

  const x = Math.sin(dLng) * Math.cos(lat2Rad)
  const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng)

  return Math.atan2(x, y) * 180 / Math.PI
}

// Get color based on progress (0-1): green -> yellow -> red
// Uses HSL for smooth progressive color transitions
function getProgressColor(progress) {
  const p = Math.max(0, Math.min(1, progress))

  // Hue goes from 120 (green) to 0 (red) as progress increases
  // This creates a smooth gradient: green -> lime -> yellow -> orange -> red
  const hue = 120 * (1 - p)

  // Keep saturation high and lightness moderate for vibrant colors
  const saturation = 85
  const lightness = 45

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

export default RouteDisplay
