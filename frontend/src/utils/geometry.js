import * as turf from '@turf/turf'

/**
 * Calculate the area of a polygon in square kilometers.
 * @param {Array<{lat: number, lng: number}>} coords - Array of coordinate objects
 * @returns {number} Area in square kilometers
 */
export function calculateArea(coords) {
  if (!coords || coords.length < 3) {
    return 0
  }

  // Convert to GeoJSON format (lng, lat order)
  const coordinates = coords.map(c => [c.lng, c.lat])

  // Close the polygon by adding the first point at the end
  if (
    coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
    coordinates[0][1] !== coordinates[coordinates.length - 1][1]
  ) {
    coordinates.push(coordinates[0])
  }

  try {
    const polygon = turf.polygon([coordinates])
    const area = turf.area(polygon) // Returns area in square meters
    return area / 1_000_000 // Convert to square kilometers
  } catch (err) {
    console.error('Error calculating area:', err)
    return 0
  }
}

/**
 * Check if a point is inside a polygon.
 * @param {Object} point - Point with lat and lng properties
 * @param {Array<{lat: number, lng: number}>} polygonCoords - Polygon coordinates
 * @returns {boolean} True if point is inside polygon
 */
export function isPointInPolygon(point, polygonCoords) {
  if (!point || !polygonCoords || polygonCoords.length < 3) {
    return false
  }

  const coordinates = polygonCoords.map(c => [c.lng, c.lat])
  if (
    coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
    coordinates[0][1] !== coordinates[coordinates.length - 1][1]
  ) {
    coordinates.push(coordinates[0])
  }

  try {
    const polygon = turf.polygon([coordinates])
    const pt = turf.point([point.lng, point.lat])
    return turf.booleanPointInPolygon(pt, polygon)
  } catch (err) {
    console.error('Error checking point in polygon:', err)
    return false
  }
}

/**
 * Calculate the center of a polygon.
 * @param {Array<{lat: number, lng: number}>} coords - Array of coordinate objects
 * @returns {{lat: number, lng: number}} Center point
 */
export function getPolygonCenter(coords) {
  if (!coords || coords.length === 0) {
    return { lat: 0, lng: 0 }
  }

  const sumLat = coords.reduce((sum, c) => sum + c.lat, 0)
  const sumLng = coords.reduce((sum, c) => sum + c.lng, 0)

  return {
    lat: sumLat / coords.length,
    lng: sumLng / coords.length
  }
}
