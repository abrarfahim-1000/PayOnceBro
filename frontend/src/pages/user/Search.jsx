// frontend/src/pages/user/Search.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Member 1 — Feature 1 (Smart Food Search) + entrypoint for Feature 2 tab.
//
// CHANGES from previous version:
//   • Removed DUMMY_RESTAURANTS / DUMMY_ITEMS / searchLocally fallback entirely
//   • Removed "demo mode" indicator — backend is the sole source of truth
//   • Empty results now show a proper empty state, not fake data
//   • "Nearby & Clustering" tab now uses the new real-backend view
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import SearchBar from '../../components/user/SearchBar'
import FoodCard from '../../components/user/FoodCard'
import RecommendationCarousel from '../../components/admin/RecommendationCarousel'
import { Button } from '../../components/ui/button'
import {
  searchFood,
  getCategories as fetchApiCategories,
} from '../../services/searchService'
import { buildCombo, getRecommendations } from '../../services/aiService'
import { useCart } from '../../context/CartContext'
import { UrlState } from '../../context/AuthContext'
import { updateSavedDeliveryLocation } from '../../services/authService'
import { normalizeMapLocation, parseLatLng } from '../../utils/geoClient'
import { toast } from 'sonner'

const LocationPickerMap = lazy(() => import('../../components/user/LocationPickerMap'))
const NearbyRestaurantsView = lazy(() => import('../../components/user/NearbyRestaurantsView'))

const ListFadeSkeleton = () => (
  <div className="space-y-3 py-2" aria-hidden>
    {[1, 2, 3].map((n) => (
      <div key={n} className="h-20 rounded-xl bg-muted/50 animate-pulse" />
    ))}
  </div>
)

// Fallback map location if geolocation is blocked (Dhaka, Gulshan area).
// This intentionally sits near the seed cluster so the clustering demo works.
const DHAKA_DEFAULT = { lat: 23.7808, lng: 90.4154 }

const HOME_FOOD_INITIAL_VISIBLE = 18
const HOME_LOAD_MORE_STEP = 18
const RECO_CAROUSEL_ITEM_CAP = 12

const Search = () => {
  const { user, fetchuser, isSessionLoaded } = UrlState()

  // ─── Map location (used by the Nearby tab and the map picker) ─────────
  const [mapLocation, setMapLocation] = useState(DHAKA_DEFAULT)
  const [locationStatus, setLocationStatus] = useState('detecting')
  //   detecting | saved | gps | default | manual

  // Prefer saved profile coords; otherwise GPS once; then Dhaka default.
  useEffect(() => {
    if (!isSessionLoaded) {
      setLocationStatus('detecting')
      return
    }

    const saved = parseLatLng(user?.delivery_lat, user?.delivery_lng)
    if (saved) {
      setMapLocation((prev) => {
        if (prev.lat === saved.lat && prev.lng === saved.lng) return prev
        return saved
      })
      setLocationStatus('saved')
      return
    }

    if (!('geolocation' in navigator)) {
      setMapLocation(normalizeMapLocation({}, DHAKA_DEFAULT))
      setLocationStatus('default')
      return
    }

    setLocationStatus('detecting')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const gps = normalizeMapLocation(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          DHAKA_DEFAULT
        )
        setMapLocation((prev) => {
          if (prev.lat === gps.lat && prev.lng === gps.lng) return prev
          return gps
        })
        setLocationStatus('gps')
      },
      () => {
        setMapLocation(normalizeMapLocation({}, DHAKA_DEFAULT))
        setLocationStatus('default')
      },
      { timeout: 5000 }
    )
  }, [isSessionLoaded, user?.delivery_lat, user?.delivery_lng])

  // ─── Tab state ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('search') // 'search' | 'nearby'

  // ─── Food search state ────────────────────────────────────────────────
  const [results, setResults] = useState([])
  const [lastQuery, setLastQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [categories, setCategories] = useState([])

  const { addItem, itemCount, subtotal, setUserLocation } = useCart()

  // ─── Recommendations (Member D) ─────────────────────────────────────
  const [recommendations, setRecommendations] = useState(null)
  const [recoLoading, setRecoLoading] = useState(false)
  const [recoError, setRecoError] = useState(null)

  // ─── Combo builder (Member D) ───────────────────────────────────────
  const [comboPrompt, setComboPrompt] = useState('')
  const [comboLoading, setComboLoading] = useState(false)
  const [comboError, setComboError] = useState(null)
  const [comboResult, setComboResult] = useState(null)

  const [foodHasMore, setFoodHasMore] = useState(false)
  const [listDbOffset, setListDbOffset] = useState(0)
  const [lastListFilters, setLastListFilters] = useState({})
  const [loadingMore, setLoadingMore] = useState(false)

  // Populate cuisine dropdown from the backend
  useEffect(() => {
    fetchApiCategories()
      .then((cats) => {
        if (Array.isArray(cats)) setCategories(cats)
      })
      .catch(() => setCategories([]))
  }, [])

  // Keep cart location in sync for delivery fee & cluster checks.
  useEffect(() => {
    setUserLocation(mapLocation.lat, mapLocation.lng)
  }, [mapLocation.lat, mapLocation.lng, setUserLocation])

  // Free recommendation payloads when browsing the Nearby tab (same parent state,
  // but search UI is unmounted — drops retained menu-shaped objects from memory).
  useEffect(() => {
    if (activeTab !== 'search') {
      setRecommendations(null)
      setRecoError(null)
    }
  }, [activeTab])

  // Fetch recommendations once location is known (and when it changes).
  useEffect(() => {
    if (activeTab !== 'search') return

    setRecoLoading(true)
    setRecoError(null)
    getRecommendations({ userLat: mapLocation.lat, userLng: mapLocation.lng })
      .then((data) => {
        if (!data || typeof data !== 'object') {
          setRecommendations(data)
          return
        }
        setRecommendations({
          ...data,
          popular: Array.isArray(data.popular)
            ? data.popular.slice(0, RECO_CAROUSEL_ITEM_CAP)
            : data.popular,
          frequentlyTogether: Array.isArray(data.frequentlyTogether)
            ? data.frequentlyTogether.slice(0, RECO_CAROUSEL_ITEM_CAP)
            : data.frequentlyTogether,
          clusterFriendly: Array.isArray(data.clusterFriendly)
            ? data.clusterFriendly.slice(0, RECO_CAROUSEL_ITEM_CAP)
            : data.clusterFriendly,
        })
      })
      .catch((err) => {
        setRecoError(err?.response?.data?.message || 'Failed to load recommendations')
        setRecommendations(null)
      })
      .finally(() => setRecoLoading(false))
  }, [activeTab, mapLocation.lat, mapLocation.lng])

  // Debounced search handler wired into SearchBar (initial empty query fires immediately from SearchBar)
  const handleSearch = useCallback(async (query, filters) => {
    setLastQuery(query)
    setLastListFilters(filters)
    setSearchLoading(true)
    setSearchError(null)
    setListDbOffset(0)
    const trimmed = query.trim()
    const browse = !trimmed
    const pageLimit = browse ? HOME_FOOD_INITIAL_VISIBLE : 50
    try {
      const merged = {
        ...filters,
        userLat: filters.userLat ?? mapLocation.lat,
        userLng: filters.userLng ?? mapLocation.lng,
        limit: pageLimit,
        offset: 0,
      }
      const data = await searchFood(trimmed, merged)
      const r = data?.results
      setResults(Array.isArray(r) ? r : [])
      setFoodHasMore(Boolean(data?.hasMore))
      setListDbOffset(Number.isFinite(data?.nextOffset) ? data.nextOffset : (r?.length ?? 0))
    } catch (err) {
      setSearchError(err?.response?.data?.message || 'Search failed. Please try again.')
      setResults([])
      setFoodHasMore(false)
      setListDbOffset(0)
    } finally {
      setSearchLoading(false)
    }
  }, [mapLocation.lat, mapLocation.lng])

  const handleLoadMoreFood = useCallback(async () => {
    if (!foodHasMore || loadingMore || searchLoading) return
    setLoadingMore(true)
    try {
      const merged = {
        ...lastListFilters,
        userLat: lastListFilters.userLat ?? mapLocation.lat,
        userLng: lastListFilters.userLng ?? mapLocation.lng,
        limit: HOME_LOAD_MORE_STEP,
        offset: listDbOffset,
      }
      const data = await searchFood(lastQuery.trim(), merged)
      const r = data?.results
      const chunk = Array.isArray(r) ? r : []
      setResults((prev) => [...prev, ...chunk])
      setFoodHasMore(Boolean(data?.hasMore))
      if (Number.isFinite(data?.nextOffset)) {
        setListDbOffset(data.nextOffset)
      } else {
        setListDbOffset((o) => o + chunk.length)
      }
    } catch {
      toast.error('Could not load more items')
    } finally {
      setLoadingMore(false)
    }
  }, [
    foodHasMore,
    loadingMore,
    searchLoading,
    lastListFilters,
    mapLocation.lat,
    mapLocation.lng,
    listDbOffset,
    lastQuery,
  ])

  // Group search results by restaurant for display
  const groups = useMemo(() => {
    const map = new Map()
    results.forEach((row) => {
      const rid = row.restaurant?.id
      if (!rid) return
      if (!map.has(rid)) {
        map.set(rid, {
          restaurant: row.restaurant,
          items: [],
          hasCluster: Boolean(row.isClusterEligible),
        })
      }
      map.get(rid).items.push(row)
    })
    return [...map.values()]
  }, [results])

  const handleAddToCart = (row) => {
    addItem(
      { id: row.menuItem.id, name: row.menuItem.name, price: Number(row.menuItem.price) },
      { id: row.restaurant.id, name: row.restaurant.name }
    )
    toast.success(`${row.menuItem.name} added to cart`)
  }

  const handleBuildCombo = async () => {
    const prompt = comboPrompt.trim()
    if (!prompt) {
      toast.error('Tell us what you want to eat')
      return
    }

    setComboLoading(true)
    setComboError(null)
    setComboResult(null)
    try {
      const data = await buildCombo({
        prompt,
        userLat: mapLocation.lat,
        userLng: mapLocation.lng,
      })
      setComboResult(data)
    } catch (err) {
      setComboError(err?.response?.data?.message || 'Failed to build a combo')
    } finally {
      setComboLoading(false)
    }
  }

  const handleAddComboToCart = () => {
    const items = Array.isArray(comboResult?.suggestedItems) ? comboResult.suggestedItems : []
    if (!items.length) return

    let added = 0
    items.forEach((row) => {
      const qty = Number(row.quantity || 1)
      const safeQty = Number.isFinite(qty) && qty > 0 ? Math.min(5, qty) : 1
      for (let i = 0; i < safeQty; i += 1) {
        addItem(
          { id: row.menuItem.id, name: row.menuItem.name, price: Number(row.menuItem.price) },
          { id: row.restaurant.id, name: row.restaurant.name }
        )
        added += 1
      }
    })

    toast.success(`Added ${added} item${added !== 1 ? 's' : ''} to cart`)
  }

  // Location-picker modal visibility
  const [showLocationPicker, setShowLocationPicker] = useState(false)

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto p-4">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-gray-900">PayOnceBro</h1>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              📍{' '}
              {locationStatus === 'detecting'
                ? 'Detecting your location…'
                : locationStatus === 'saved'
                  ? 'Using your saved delivery location'
                  : locationStatus === 'gps'
                    ? 'Using your GPS location'
                    : locationStatus === 'manual'
                      ? 'Using a location you set'
                      : 'Using Dhaka (Gulshan) — default'}
              <button
                onClick={() => setShowLocationPicker(true)}
                className="text-orange-600 hover:text-orange-700 underline ml-1 font-semibold"
              >
                Change
              </button>
            </p>
          </div>
          {itemCount > 0 && (
            <Link
              to="/cart"
              className="shrink-0 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 hover:bg-orange-100 transition"
            >
              <span className="text-lg">🛒</span>
              <div className="text-xs">
                <p className="font-bold text-orange-700">
                  {itemCount} item{itemCount !== 1 ? 's' : ''}
                </p>
                <p className="text-orange-500">৳{subtotal.toFixed(0)}</p>
              </div>
            </Link>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 mb-5">
          {[
            { key: 'search', label: '🔍 All food' },
            { key: 'nearby', label: '🔗 Nearby & Clustering' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                activeTab === t.key
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ───────── TAB 1: All food (search) ───────────────────────────── */}
        {activeTab === 'search' && (
          <>
            <div className="mb-5">
              <SearchBar
                onSearch={handleSearch}
                categories={categories}
                loading={searchLoading}
              />
            </div>

            {/* Recommendations (must appear between search bar and general food list) */}
            <div className="space-y-4 mb-6">
              <RecommendationCarousel
                title="✨ Recommended for you"
                subtitle={recoLoading ? 'Loading personalized picks…' : 'Popular picks near you'
                }
                items={recommendations?.popular ?? []}
                onAddToCart={handleAddToCart}
              />

              {(recommendations?.frequentlyTogether ?? []).length > 0 && (
                <RecommendationCarousel
                  title="🧠 Frequently ordered together"
                  subtitle="Based on your recent orders"
                  items={recommendations?.frequentlyTogether ?? []}
                  onAddToCart={handleAddToCart}
                />
              )}

              {(recommendations?.clusterFriendly ?? []).length > 0 && (
                <RecommendationCarousel
                  title="🔗 Cluster-friendly picks"
                  subtitle="Great options to save on delivery"
                  items={recommendations?.clusterFriendly ?? []}
                  onAddToCart={handleAddToCart}
                />
              )}

              {recoError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {recoError}
                </div>
              )}
            </div>

            {/* AI combo builder — directly under recommendation carousels, above All food list */}
            <div className="rounded-2xl border bg-card p-4 mb-6">
              <form
                className="contents"
                onSubmit={(e) => {
                  e.preventDefault()
                  handleBuildCombo()
                }}
              >
                <div>
                  <h3 className="text-base font-black text-card-foreground">🤝 Build me a combo</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tell us your mood, diet, or budget (e.g. &quot;spicy halal under 350&quot;).
                  </p>
                </div>

                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <textarea
                    value={comboPrompt}
                    onChange={(e) => setComboPrompt(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                    placeholder="What should I order today?"
                  />
                  <Button type="submit" disabled={comboLoading} className="sm:w-40">
                    {comboLoading ? 'Thinking…' : 'Build combo'}
                  </Button>
                </div>
              </form>

              {comboError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {comboError}
                </div>
              )}

              {comboResult && (
                <div className="mt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-card-foreground">Suggested combo</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {comboResult.explanation}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-lg font-black">৳{Number(comboResult.totalPrice || 0).toFixed(0)}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(comboResult.suggestedItems ?? []).map((row) => (
                      <div key={row.menuItem.id} className="relative">
                        <FoodCard
                          item={{
                            menuItem: row.menuItem,
                            restaurant: row.restaurant,
                            distanceKm: null,
                            isClusterEligible: false,
                          }}
                          onAddToCart={() =>
                            handleAddToCart({
                              menuItem: row.menuItem,
                              restaurant: row.restaurant,
                              distanceKm: null,
                              isClusterEligible: false,
                            })
                          }
                        />
                        {Number(row.quantity || 1) > 1 && (
                          <div className="absolute top-3 right-3 rounded-full bg-secondary text-secondary-foreground text-xs font-bold px-2 py-1">
                            x{Math.min(5, Number(row.quantity || 1))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setComboResult(null)}>
                      Clear
                    </Button>
                    <Button type="button" onClick={handleAddComboToCart}>
                      Add all to cart
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {searchLoading
                    ? '🍔 What are you craving?'
                    : lastQuery
                      ? `Results for "${lastQuery}"`
                      : 'All food'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {results.length} item{results.length !== 1 ? 's' : ''} across{' '}
                  {groups.length} restaurant{groups.length !== 1 ? 's' : ''}
                  {foodHasMore ? ' · more available' : ''}
                </p>
              </div>
            </div>

            {searchError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-4">
                {searchError}
              </div>
            )}

            {!searchError && !searchLoading && results.length === 0 && (
              <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-10 text-center">
                <span className="text-5xl">🍽️</span>
                <p className="mt-3 font-bold text-gray-700">Nothing found</p>
                <p className="text-sm text-gray-500 mt-1">
                  Try different search terms, clear filters, or seed the database.
                </p>
              </div>
            )}

            <div className="space-y-8">
              {groups.map(({ restaurant, items, hasCluster }) => (
                <section key={restaurant.id}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white font-black text-lg shadow-sm">
                      {restaurant.name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/restaurants/${restaurant.id}`}
                        className="font-bold text-gray-900 hover:text-orange-600 transition"
                      >
                        {restaurant.name}
                      </Link>
                      <p className="text-xs text-gray-400 truncate">
                        {restaurant.address}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-amber-500 shrink-0">
                      ⭐ {Number(restaurant.avgRating || 0).toFixed(1)}
                    </span>
                  </div>

                  {hasCluster && (
                    <div className="mb-3 rounded-xl bg-linear-to-r from-emerald-50 to-teal-50 border border-emerald-200 px-4 py-2.5 flex items-center gap-2">
                      <span className="text-xl">🔗</span>
                      <div>
                        <p className="text-sm font-bold text-emerald-700">
                          Cluster Delivery Available!
                        </p>
                        <p className="text-xs text-emerald-600">
                          Near other restaurants — order from multiple and save on
                          delivery fees.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((row) => (
                      <FoodCard
                        key={row.menuItem.id}
                        item={row}
                        onAddToCart={handleAddToCart}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {foodHasMore && !searchError && results.length > 0 && (
              <div className="flex justify-center mt-8">
                <Button
                  type="button"
                  variant="outline"
                  className="font-semibold"
                  disabled={loadingMore}
                  onClick={() => handleLoadMoreFood()}
                >
                  {loadingMore ? 'Loading…' : 'Load more food'}
                </Button>
              </div>
            )}
          </>
        )}

        {/* ───────── TAB 2: Nearby & Clustering ─────────────────────────── */}
        {activeTab === 'nearby' && (
          <Suspense fallback={<ListFadeSkeleton />}>
            <NearbyRestaurantsView userLocation={mapLocation} />
          </Suspense>
        )}
      </div>

      {showLocationPicker && (
        <Suspense
          fallback={
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
              role="status"
              aria-live="polite"
            >
              <p className="rounded-xl bg-white px-5 py-3 text-sm font-medium shadow-lg">
                Loading map…
              </p>
            </div>
          }
        >
          <LocationPickerMap
            isOpen={showLocationPicker}
            onClose={() => setShowLocationPicker(false)}
            initialLocation={mapLocation}
            onConfirm={async (picked) => {
              setMapLocation({ lat: picked.lat, lng: picked.lng })
              setLocationStatus('manual')
              if (user?.role === 'user') {
                try {
                  await updateSavedDeliveryLocation({ lat: picked.lat, lng: picked.lng })
                  await fetchuser()
                  toast.success('Delivery location saved to your profile')
                } catch {
                  toast.error('Could not save location to your profile')
                }
              } else {
                toast.success('Delivery location updated')
              }
            }}
          />
        </Suspense>
      )}
    </div>
  )
}

export default Search