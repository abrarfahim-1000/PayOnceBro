import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Card } from '../ui/card'

/**
 * SearchBar.jsx
 *
 * This is the search box + filter panel at the top of the Search page.
 *
 * It has:
 * - A text input where users type food names
 * - A price range filter (min ৳ and max ৳)
 * - A cuisine/category dropdown
 * - A "Use my location" button
 *
 * Props:
 *   onSearch(query, filters) - called whenever any filter changes
 *   categories               - array of category strings for the dropdown
 *   loading                  - shows a spinner in the search box
 */
const SearchBar = ({ onSearch, categories = [], loading = false }) => {
  const [query, setQuery] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [location, setLocation] = useState(null) // { lat, lng }
  const [locationStatus, setLocationStatus] = useState('idle') // idle | loading | granted | denied
  const [showFilters, setShowFilters] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (locationStatus !== 'denied') return
    toast.error('Location access denied. Showing price-sorted results.')
  }, [locationStatus])

  // Every time ANY filter changes, we wait 400ms then call onSearch.
  // "Debouncing" = waiting a little bit so we don't search on every single
  // keystroke. Like waiting for someone to finish talking before responding!
  useEffect(() => {
    clearTimeout(debounceRef.current)
    const idle =
      !query && !minPrice && !maxPrice && !cuisine && !location
    const delay = idle ? 0 : 400
    debounceRef.current = setTimeout(() => {
      onSearch(query, {
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
        cuisine: cuisine || undefined,
        userLat: location?.lat,
        userLng: location?.lng,
      })
    }, delay)

    return () => clearTimeout(debounceRef.current)
  }, [query, minPrice, maxPrice, cuisine, location, onSearch])
  // NOTE: parent should memoize onSearch with useCallback to preserve debounce behavior.

  // Ask the browser for the user's GPS location
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('denied')
      return
    }
    setLocationStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationStatus('granted')
      },
      () => setLocationStatus('denied')
    )
  }

  const hasActiveFilters = minPrice || maxPrice || cuisine

  return (
    <div className="space-y-3">
      {/* Main search row */}
      <div className="flex gap-2">
        {/* Search input */}
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg select-none">
            🔍
          </span>
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for food... (e.g. burger, pasta, rice)"
            className="w-full pl-10 pr-10 h-11 bg-card"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin text-lg">
              ⏳
            </span>
          )}
        </div>

        {/* Filters toggle button */}
        <Button
          type="button"
          variant={showFilters || hasActiveFilters ? 'default' : 'outline'}
          onClick={() => setShowFilters((v) => !v)}
          className="h-11"
        >
          🎛️ Filter{hasActiveFilters ? ' •' : ''}
        </Button>

        {/* Location button */}
        <Button
          type="button"
          onClick={requestLocation}
          disabled={locationStatus === 'loading'}
          title={
            locationStatus === 'granted'
              ? 'Location active — nearby restaurants shown first'
              : 'Click to show nearby restaurants first'
          }
          variant="outline"
          className={`h-11 ${
            locationStatus === 'granted'
              ? 'bg-primary text-primary-foreground border-primary'
              : locationStatus === 'denied'
              ? 'bg-destructive/10 text-destructive border-destructive/20'
              : 'text-muted-foreground'
          }`}
        >
          {locationStatus === 'loading'
            ? '⏳'
            : locationStatus === 'granted'
            ? '📍'
            : locationStatus === 'denied'
            ? '🚫'
            : '📍?'}
        </Button>
      </div>

      {/* Expandable filter panel */}
      {showFilters && (
        <Card className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-200 bg-card">
          {/* Min price */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Min Price (৳)
            </label>
            <Input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="0"
              min="0"
              className="w-full"
            />
          </div>

          {/* Max price */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Max Price (৳)
            </label>
            <Input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Any"
              min="0"
              className="w-full"
            />
          </div>

          {/* Cuisine / category */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Cuisine Type
            </label>
            <select
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All cuisines</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <div className="sm:col-span-3 flex justify-end">
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setMinPrice('')
                  setMaxPrice('')
                  setCuisine('')
                }}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Clear all filters
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Location tip */}
      {locationStatus === 'granted' && (
        <p className="text-xs text-primary flex items-center gap-1">
          <span>✅</span> Location active — nearby restaurants shown first and cluster savings highlighted
        </p>
      )}
    </div>
  )
}

export default SearchBar