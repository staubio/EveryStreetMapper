import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useMap } from 'react-leaflet'

function SearchBox() {
  const map = useMap()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const searchLocation = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 3) {
      setResults([])
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`,
        {
          headers: {
            'User-Agent': 'EveryStreetMapper/1.0'
          }
        }
      )
      const data = await response.json()
      setResults(data)
      setShowResults(true)
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleInputChange = useCallback((e) => {
    const value = e.target.value
    setQuery(value)

    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      searchLocation(value)
    }, 300)
  }, [searchLocation])

  const handleSelectResult = useCallback((result) => {
    const lat = parseFloat(result.lat)
    const lon = parseFloat(result.lon)
    map.setView([lat, lon], 15)
    setQuery(result.display_name.split(',')[0])
    setShowResults(false)
    setResults([])
  }, [map])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && results.length > 0) {
      handleSelectResult(results[0])
    }
  }, [results, handleSelectResult])

  return (
    <div ref={containerRef} className="search-box-container">
      <input
        type="text"
        className="search-input"
        placeholder="Search location..."
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setShowResults(true)}
      />
      {isLoading && <div className="search-loading">...</div>}
      {showResults && results.length > 0 && (
        <ul className="search-results">
          {results.map((result, index) => (
            <li
              key={result.place_id || index}
              onClick={() => handleSelectResult(result)}
              className="search-result-item"
            >
              {result.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default SearchBox
