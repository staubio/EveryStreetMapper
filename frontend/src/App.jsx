import React, { useState, useCallback } from 'react'
import Map from './components/Map'
import Controls from './components/Controls'
import { useApi } from './hooks/useApi'
import { calculateArea } from './utils/geometry'

const MAX_AREA_SQ_KM = 5

function App() {
  const [polygon, setPolygon] = useState(null)
  const [startPoint, setStartPoint] = useState(null)
  const [route, setRoute] = useState(null)
  const [streets, setStreets] = useState(null)
  const [routeStats, setRouteStats] = useState(null)
  const [areaSize, setAreaSize] = useState(null)
  const [honorOneways, setHonorOneways] = useState(false)

  const { loading, error, calculateRoute, downloadGPX, clearError } = useApi()

  const handlePolygonCreated = useCallback((coords) => {
    setPolygon(coords)
    setRoute(null)
    setStreets(null)
    setRouteStats(null)
    clearError()

    // Calculate area
    const area = calculateArea(coords)
    setAreaSize(area)
  }, [clearError])

  const handlePolygonDeleted = useCallback(() => {
    setPolygon(null)
    setStartPoint(null)
    setRoute(null)
    setStreets(null)
    setRouteStats(null)
    setAreaSize(null)
    clearError()
  }, [clearError])

  const handleStartPointSet = useCallback((point) => {
    setStartPoint(point)
    clearError()
  }, [clearError])

  const handleCalculateRoute = useCallback(async () => {
    if (!polygon || !startPoint) return

    const result = await calculateRoute(polygon, startPoint, { honorOneways })
    if (result) {
      setRoute(result.route)

      // Count turns (direction changes > 30 degrees)
      // First simplify route to avoid counting multiple small turns at intersections
      let turnCount = 0
      const turnThreshold = 30
      const distanceThreshold = 0.00015 // ~15 meters

      // Simplify route first
      const simplified = [result.route[0]]
      for (let i = 1; i < result.route.length - 1; i++) {
        const prev = simplified[simplified.length - 1]
        const curr = result.route[i]
        const dist = Math.sqrt(
          Math.pow(curr.lat - prev.lat, 2) +
          Math.pow((curr.lng - prev.lng) * Math.cos(curr.lat * Math.PI / 180), 2)
        )
        if (dist >= distanceThreshold) {
          simplified.push(curr)
        }
      }
      simplified.push(result.route[result.route.length - 1])

      // Count turns on simplified route
      for (let i = 1; i < simplified.length - 1; i++) {
        const prev = simplified[i - 1]
        const curr = simplified[i]
        const next = simplified[i + 1]

        const bearingIn = Math.atan2(curr.lng - prev.lng, curr.lat - prev.lat) * 180 / Math.PI
        const bearingOut = Math.atan2(next.lng - curr.lng, next.lat - curr.lat) * 180 / Math.PI

        let turnAngle = Math.abs(bearingOut - bearingIn)
        if (turnAngle > 180) turnAngle = 360 - turnAngle

        if (turnAngle >= turnThreshold) {
          turnCount++
        }
      }

      setRouteStats({
        totalDistance: result.total_distance_km,
        uniqueDistance: result.unique_distance_km,
        overlapPercentage: result.overlap_percentage,
        turnCount: turnCount
      })
    }
  }, [polygon, startPoint, calculateRoute, honorOneways])

  const handleDownloadGPX = useCallback(async () => {
    if (!route) return
    await downloadGPX(route, 'EveryStreet_Route')
  }, [route, downloadGPX])

  const handleClearRoute = useCallback(() => {
    setRoute(null)
    setRouteStats(null)
    clearError()
  }, [clearError])

  const isAreaValid = areaSize !== null && areaSize <= MAX_AREA_SQ_KM
  const canCalculate = polygon && startPoint && isAreaValid && !loading

  return (
    <div className="app-container">
      <Map
        polygon={polygon}
        startPoint={startPoint}
        route={route}
        streets={streets}
        onPolygonCreated={handlePolygonCreated}
        onPolygonDeleted={handlePolygonDeleted}
        onStartPointSet={handleStartPointSet}
      />
      <Controls
        polygon={polygon}
        startPoint={startPoint}
        route={route}
        routeStats={routeStats}
        areaSize={areaSize}
        maxAreaSize={MAX_AREA_SQ_KM}
        isAreaValid={isAreaValid}
        loading={loading}
        error={error}
        canCalculate={canCalculate}
        honorOneways={honorOneways}
        onHonorOnewaysChange={setHonorOneways}
        onCalculateRoute={handleCalculateRoute}
        onDownloadGPX={handleDownloadGPX}
        onClearRoute={handleClearRoute}
      />
    </div>
  )
}

export default App
