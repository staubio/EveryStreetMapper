import React from 'react'

// Conversion constants
const KM_TO_MILES = 0.621371
const SQ_KM_TO_SQ_MILES = 0.386102

function Controls({
  polygon,
  startPoint,
  route,
  routeStats,
  areaSize,
  maxAreaSize,
  isAreaValid,
  loading,
  error,
  canCalculate,
  honorOneways,
  onHonorOnewaysChange,
  useMetric,
  onUseMetricChange,
  onCalculateRoute,
  onDownloadGPX,
  onClearRoute
}) {
  // Helper to format distance
  const formatDistance = (km) => {
    if (useMetric) {
      return `${km.toFixed(2)} km`
    }
    return `${(km * KM_TO_MILES).toFixed(2)} mi`
  }

  // Helper to format area
  const formatArea = (sqKm) => {
    if (useMetric) {
      return `${sqKm.toFixed(2)} km²`
    }
    return `${(sqKm * SQ_KM_TO_SQ_MILES).toFixed(2)} mi²`
  }
  return (
    <div className="sidebar">
      <div>
        <h1>EveryStreet Mapper</h1>
        <p>Calculate optimal routes to cover every street in a selected area.</p>
      </div>

      <div className="section instructions">
        <ol>
          <li>Use the drawing tools on the map to select an area (polygon or rectangle)</li>
          <li>Click on the map to set your starting point</li>
          <li>Click "Calculate Route" to generate the optimal path</li>
          <li>Download the GPX file for navigation</li>
        </ol>
        <div style={{ marginTop: '12px', fontSize: '0.75rem', color: '#6c757d' }}>
          by <a href="https://bsky.app/profile/staubio.com" target="_blank" rel="noopener noreferrer" style={{ color: '#007bff' }}>@staubio</a>
        </div>
      </div>

      <div className="section">
        <h2>Status</h2>
        <div className="status-item">
          <span className="status-label">Area Selected</span>
          <span className={`status-value ${polygon ? 'success' : ''}`}>
            {polygon ? 'Yes' : 'No'}
          </span>
        </div>
        {areaSize !== null && (
          <div className="status-item">
            <span className="status-label">Area Size</span>
            <span className={`status-value ${isAreaValid ? 'success' : 'error'}`}>
              {formatArea(areaSize)} {!isAreaValid && `(max ${formatArea(maxAreaSize)})`}
            </span>
          </div>
        )}
        <div className="status-item">
          <span className="status-label">Start Point Set</span>
          <span className={`status-value ${startPoint ? 'success' : ''}`}>
            {startPoint ? 'Yes' : 'No'}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">Route Calculated</span>
          <span className={`status-value ${route ? 'success' : ''}`}>
            {route ? 'Yes' : 'No'}
          </span>
        </div>
        <div className="status-item" style={{ marginTop: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={honorOneways}
              onChange={(e) => onHonorOnewaysChange(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Honor one-way streets</span>
          </label>
        </div>
        <div className="status-item" style={{ marginTop: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={useMetric}
              onChange={(e) => onUseMetricChange(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Use metric units</span>
          </label>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading && (
        <div className="loading-message">
          <div className="spinner"></div>
          <span>Calculating optimal route...</span>
        </div>
      )}

      {routeStats && (
        <div className="section">
          <h2>Route Statistics</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{formatDistance(routeStats.totalDistance)}</div>
              <div className="stat-label">Total Distance</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{formatDistance(routeStats.uniqueDistance)}</div>
              <div className="stat-label">Unique Distance</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{routeStats.overlapPercentage}%</div>
              <div className="stat-label">Overlap</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{routeStats.turnCount}</div>
              <div className="stat-label">Turns</div>
            </div>
          </div>
          <div className="route-legend">
            <div className="route-legend-title">Route Legend</div>
            <div className="route-legend-item">
              <div className="route-legend-gradient"></div>
              <span>Progress (green→yellow→red)</span>
            </div>
            <div className="route-legend-item">
              <div style={{background: '#27ae60', color: 'white', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold'}}>S</div>
              <span>Start</span>
            </div>
            <div className="route-legend-item">
              <div style={{background: '#c0392b', color: 'white', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold'}}>E</div>
              <span>End</span>
            </div>
            <div className="route-legend-item">
              <span style={{fontSize: '10px', color: '#333'}}>▶</span>
              <span>Direction</span>
            </div>
          </div>
        </div>
      )}

      <div className="section btn-group">
        <button
          className="btn btn-primary"
          onClick={onCalculateRoute}
          disabled={!canCalculate}
        >
          {loading ? 'Calculating...' : 'Calculate Route'}
        </button>

        {route && (
          <>
            <button
              className="btn btn-success"
              onClick={onDownloadGPX}
              disabled={loading}
            >
              Download GPX
            </button>
            <button
              className="btn btn-secondary"
              onClick={onClearRoute}
              disabled={loading}
            >
              Clear Route
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default Controls
