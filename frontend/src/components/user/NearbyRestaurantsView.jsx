// frontend/src/components/user/NearbyRestaurantsView.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Member 1 — Feature 2 (AI-Based Restaurant Clustering) live view.
//
// This component REPLACES the previous demo-data version. It now:
//   1. Fetches real clusters from GET /api/cluster/nearby
//   2. Fetches the real menu by calling GET /api/public/restaurants/:id on
//      first expansion of each restaurant card (menus load lazily to keep
//      the initial view snappy)
//   3. Integrates with CartContext for "Add to cart"
//
// Props:
//   • userLocation: { lat, lng }  required; used to find nearby clusters
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { getPublicRestaurant } from '../../services/publicRestaurantService'
import { useCart } from '../../context/CartContext'
import { toast } from 'sonner'

// Small colour palette so each cluster gets its own colour on screen.
const CLUSTER_COLORS = ['#059669', '#7c3aed', '#f97316', '#0ea5e9', '#e11d48']

// Haversine used purely for client-side distance displays (matches backend).
const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Individual restaurant card (expandable) ──────────────────────────────────

const RestaurantCard = ({ restaurant, clusterColor, distanceKm }) => {
  const [expanded, setExpanded] = useState(false)
  const [menu, setMenu] = useState(null)
  const [loadingMenu, setLoadingMenu] = useState(false)
  const { items, addItem, updateQuantity } = useCart()

  // Lazy-load the menu when the user expands for the first time.
  useEffect(() => {
    if (!expanded || menu !== null || loadingMenu) return
    setLoadingMenu(true)
    getPublicRestaurant(restaurant.id)
      .then((data) => setMenu(Array.isArray(data.menu) ? data.menu : []))
      .catch(() => setMenu([]))
      .finally(() => setLoadingMenu(false))
  }, [expanded, menu, loadingMenu, restaurant.id])

  const qtyOf = (menuItemId) =>
    items.find((i) => i.menuItemId === menuItemId)?.quantity ?? 0

  const handleAdd = (item) => {
    addItem(
      { id: item.id, name: item.name, price: Number(item.price) },
      { id: restaurant.id, name: restaurant.name }
    )
    toast.success(`${item.name} added to cart`)
  }

  return (
    <div
      className="bg-white rounded-xl border shadow-sm overflow-hidden transition-all"
      style={{ borderColor: clusterColor || '#e5e7eb' }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-black text-lg shrink-0"
          style={{
            background: clusterColor
              ? `linear-gradient(135deg, ${clusterColor}, ${clusterColor}dd)`
              : 'linear-gradient(135deg, #fb923c, #f43f5e)',
          }}
        >
          {restaurant.name?.[0] || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 truncate">{restaurant.name}</p>
          <p className="text-xs text-gray-500 truncate">
            {restaurant.address || '—'}
          </p>
          <div className="flex gap-2 mt-0.5 text-[11px] text-gray-500">
            {typeof distanceKm === 'number' && (
              <span>📍 {distanceKm.toFixed(2)} km</span>
            )}
            {restaurant.avg_prep_time && <span>⏱ ~{restaurant.avg_prep_time} min</span>}
            {restaurant.avg_rating > 0 && <span>⭐ {Number(restaurant.avg_rating).toFixed(1)}</span>}
          </div>
        </div>
        <div className="shrink-0">
          <Link
            to={`/restaurants/${restaurant.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-semibold text-orange-600 hover:text-orange-700 mr-3"
          >
            View
          </Link>
          <span className={`text-gray-400 transition-transform inline-block ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          {loadingMenu && (
            <p className="text-xs text-gray-400 animate-pulse py-3">Loading menu…</p>
          )}

          {!loadingMenu && menu && menu.length === 0 && (
            <p className="text-xs text-gray-400 py-3">No items available right now.</p>
          )}

          {!loadingMenu && menu && menu.length > 0 && (
            <ul className="divide-y divide-gray-50">
              {menu.map((item) => {
                const qty = qtyOf(item.id)
                return (
                  <li key={item.id} className="py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-gray-500 line-clamp-1">{item.description}</p>
                      )}
                      <p className="text-sm font-bold text-orange-600 mt-0.5">
                        ৳{Number(item.price).toFixed(0)}
                      </p>
                    </div>
                    {qty === 0 ? (
                      <button
                        onClick={() => handleAdd(item)}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 active:scale-95 transition"
                      >
                        + Add
                      </button>
                    ) : (
                      <div className="shrink-0 flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(item.id, qty - 1)}
                          className="w-7 h-7 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-bold"
                        >
                          −
                        </button>
                        <span className="text-sm font-semibold w-5 text-center">{qty}</span>
                        <button
                          onClick={() => updateQuantity(item.id, qty + 1)}
                          className="w-7 h-7 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const NearbyRestaurantsView = ({ userLocation }) => {
  const [clusters, setClusters] = useState([])
  const [nearbyStandalone, setNearbyStandalone] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { itemCount, subtotal } = useCart()

  const lat = userLocation?.lat
  const lng = userLocation?.lng

  // Fetch clusters AND the search results (used to find non-clustered nearby
  // restaurants). Both calls happen in parallel. Abort on unmount / lat-lng
  // change so Strict Mode or quick tab switches don't apply stale responses twice.
  useEffect(() => {
    if (lat == null || lng == null) return

    const ac = new AbortController()
    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const clustersPromise = api
          .get('/cluster/nearby', {
            params: { userLat: lat, userLng: lng },
            signal: ac.signal,
          })
          .then((r) => r.data)

        const searchPromise = api
          .get('/search', {
            params: { userLat: lat, userLng: lng },
            signal: ac.signal,
          })
          .then((r) => r.data)

        const [clustersData, searchData] = await Promise.all([clustersPromise, searchPromise])

        if (cancelled) return

        setClusters(Array.isArray(clustersData.clusters) ? clustersData.clusters : [])

        const clusteredIds = new Set()
        ;(clustersData.clusters ?? []).forEach((c) =>
          (c.restaurants ?? []).forEach((r) => clusteredIds.add(r.id))
        )

        const seen = new Map()
        ;(searchData.results ?? []).forEach((row) => {
          const r = row.restaurant
          if (!r?.id || clusteredIds.has(r.id)) return
          if (!seen.has(r.id)) {
            seen.set(r.id, {
              ...r,
              distanceKm: row.distanceKm ?? haversine(lat, lng, r.lat, r.lng),
            })
          }
        })

        const standalone = [...seen.values()]
          .filter((r) => r.lat != null && r.lng != null)
          .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
          .slice(0, 10)

        setNearbyStandalone(standalone)
      } catch (err) {
        const aborted =
          cancelled ||
          err?.code === 'ERR_CANCELED' ||
          err?.name === 'CanceledError' ||
          (typeof err?.message === 'string' && err.message.toLowerCase().includes('cancel'))
        if (aborted) return
        setError(err?.response?.data?.message || err?.message || 'Failed to load restaurants')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [lat, lng])

  // Decorated clusters with distanceKm per restaurant for display
  const decoratedClusters = useMemo(
    () =>
      clusters.map((c, i) => ({
        ...c,
        color: CLUSTER_COLORS[i % CLUSTER_COLORS.length],
        letter: String.fromCharCode(65 + i), // A, B, C ...
        restaurants: (c.restaurants ?? []).map((r) => ({
          ...r,
          distanceKm: haversine(lat ?? 0, lng ?? 0, r.lat, r.lng),
        })),
      })),
    [clusters, lat, lng]
  )

  // ─── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  // ─── Error state ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    )
  }

  const hasClusters = decoratedClusters.length > 0
  const hasStandalone = nearbyStandalone.length > 0

  // ─── Empty state ────────────────────────────────────────────────────────
  if (!hasClusters && !hasStandalone) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
        <span className="text-3xl">🍽️</span>
        <p className="text-sm text-gray-500 mt-2">
          No restaurants near this location. Try moving your location.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-32">
      {/* ─── Clusters ────────────────────────────────────────────────────── */}
      {hasClusters && (
        <section>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-2 h-7 rounded-full bg-emerald-500" />
            <h2 className="font-black text-gray-900 text-lg">
              🔗 Clustered — combined delivery available
            </h2>
          </div>
          <p className="text-xs text-gray-500 ml-4 mb-4">
            Restaurants within 2 km of each other. Order from any combination in the
            same cluster for one combined delivery fee.
          </p>

          <div className="space-y-6">
            {decoratedClusters.map((cluster) => (
              <div
                key={cluster.letter}
                className="rounded-2xl border-2 p-4 bg-white"
                style={{ borderColor: cluster.color }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-white font-black text-sm rounded-full w-7 h-7 flex items-center justify-center"
                    style={{ background: cluster.color }}
                  >
                    {cluster.letter}
                  </span>
                  <p className="text-sm font-bold text-gray-800">
                    Cluster {cluster.letter} · {cluster.restaurantCount} restaurant
                    {cluster.restaurantCount !== 1 ? 's' : ''}
                  </p>
                  <span className="ml-auto text-xs text-gray-500">
                    max {cluster.maxDistanceKm?.toFixed?.(2) ?? '?'} km apart
                  </span>
                </div>
                <div className="space-y-2">
                  {cluster.restaurants.map((r) => (
                    <RestaurantCard
                      key={r.id}
                      restaurant={r}
                      clusterColor={cluster.color}
                      distanceKm={r.distanceKm}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Divider ────────────────────────────────────────────────────── */}
      {hasClusters && hasStandalone && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-gray-50 px-4 text-xs text-gray-400 font-semibold uppercase tracking-widest">
              Outside cluster range
            </span>
          </div>
        </div>
      )}

      {/* ─── Standalone ──────────────────────────────────────────────────── */}
      {hasStandalone && (
        <section>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-2 h-7 rounded-full bg-gray-400" />
            <h2 className="font-black text-gray-900 text-lg">🚚 Standard Delivery</h2>
          </div>
          <p className="text-xs text-gray-500 ml-4 mb-4">
            These restaurants aren't close enough to any other for a combined pickup —
            ordering from them uses a regular per-restaurant delivery fee.
          </p>
          <div className="space-y-3">
            {nearbyStandalone.map((r) => (
              <RestaurantCard
                key={r.id}
                restaurant={r}
                clusterColor={null}
                distanceKm={r.distanceKm}
              />
            ))}
          </div>
        </section>
      )}

      {/* ─── Sticky cart bar ────────────────────────────────────────────── */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent pointer-events-none">
          <div className="max-w-5xl mx-auto pointer-events-auto">
            <Link
              to="/cart"
              className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-gray-900 text-white shadow-2xl hover:bg-gray-800 active:scale-[0.99] transition"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">🛒</span>
                <div className="text-left">
                  <p className="text-xs text-gray-300">
                    {itemCount} item{itemCount !== 1 ? 's' : ''} in cart
                  </p>
                  <p className="text-sm font-bold">৳{subtotal.toFixed(0)} + delivery</p>
                </div>
              </div>
              <span className="text-sm font-bold">View cart →</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default NearbyRestaurantsView
