import { useState, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function useApi() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const calculateRoute = useCallback(async (polygon, startPoint, options = {}) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/route/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          polygon: polygon,
          start_point: startPoint,
          honor_oneways: options.honorOneways || false
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP error: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (err) {
      setError(err.message || 'Failed to calculate route')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchStreets = useCallback(async (polygon) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/streets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ polygon })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP error: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (err) {
      setError(err.message || 'Failed to fetch streets')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const downloadGPX = useCallback(async (route, name = 'EveryStreet_Route') => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/route/gpx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ route, name })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP error: ${response.status}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name.replace(/\s+/g, '_')}.gpx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      return true
    } catch (err) {
      setError(err.message || 'Failed to download GPX')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    clearError,
    calculateRoute,
    fetchStreets,
    downloadGPX
  }
}
