// frontend/src/pages/user/Cart.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Member 1 — Multi-Restaurant Cart + Delivery Fee + ETA display.
//
// UPGRADES over the previous version:
//   • Adds THREE fallbacks for setting the delivery location, so the cart
//     is never stuck when browser geolocation is blocked:
//       1. "Use my GPS" button — same as before
//       2. "Pick on map" button — opens the full LocationPickerMap modal
//       3. "Use Dhaka (test)" button — 1-click location for demos
//       4. Manual lat/lng form — for any coords anywhere
//   • Keeps every existing behavior: cluster banner, ClusterBanner component,
//     CartSummary with ETA pill, place-order flow.
//
// No backend code was changed — this file only calls existing endpoints via
// the CartContext and orderService.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { UrlState } from '../../context/AuthContext'
import CartItem from '../../components/user/CartItem'
import CartSummary from '../../components/user/CartSummary'
import ClusterBanner from '../../components/user/ClusterBanner'
import LocationPickerMap from '../../components/user/LocationPickerMap'
import { placeOrder } from '../../services/orderService'
import { updateSavedDeliveryLocation } from '../../services/authService'
import { parseLatLng } from '../../utils/geoClient'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Card } from '../../components/ui/card'

// Test coordinates that sit right on the seed-data Cluster A (Gulshan).
// Using these guarantees the cluster banner + ETA render as expected.
const DHAKA_DEFAULT = { lat: 23.7808, lng: 90.4154 }

const Cart = () => {
  const navigate = useNavigate()
  const { user, fetchuser, isSessionLoaded } = UrlState()
  const {
    items,
    itemsByRestaurant,
    clusterStatus,
    checkingCluster,
    subtotal,
    itemCount,
    clearCart,
    setUserLocation,
    userLocation,
  } = useCart()

  const [placingOrder, setPlacingOrder] = useState(false)
  const [locationStatus, setLocationStatus] = useState(
    userLocation ? 'granted' : 'idle'
  )
  const [showManualForm, setShowManualForm] = useState(false)
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')

  const userId = user?.id
  const userRole = user?.role
  const userDeliveryLat = user?.delivery_lat
  const userDeliveryLng = user?.delivery_lng

  // Apply saved profile delivery location when available (overrides stale session storage).
  useEffect(() => {
    if (!isSessionLoaded || !userId || userRole !== 'user') return
    const parsed = parseLatLng(userDeliveryLat, userDeliveryLng)
    if (!parsed) return
    setUserLocation(parsed.lat, parsed.lng)
  }, [isSessionLoaded, userId, userRole, userDeliveryLat, userDeliveryLng, setUserLocation])

  // Keep the local "granted" indicator in sync with context (covers the case
  // where location was set by another page — e.g. the map picker on Search).
  useEffect(() => {
    if (Number.isFinite(userLocation?.lat) && Number.isFinite(userLocation?.lng)) {
      setLocationStatus('granted')
    }
  }, [userLocation])

  const mapPickerInitialLocation = useMemo(() => {
    const fromSession = parseLatLng(userLocation?.lat, userLocation?.lng)
    if (fromSession) return fromSession
    const saved = parseLatLng(user?.delivery_lat, user?.delivery_lng)
    if (saved) return saved
    return DHAKA_DEFAULT
  }, [userLocation?.lat, userLocation?.lng, user?.delivery_lat, user?.delivery_lng])

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('denied')
      toast.error('Your browser does not support geolocation.')
      return
    }
    setLocationStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation(pos.coords.latitude, pos.coords.longitude)
        setLocationStatus('granted')
        toast.success('Location set from GPS')
      },
      (err) => {
        setLocationStatus('denied')
        const msg =
          err?.code === 1
            ? 'Location permission was denied.'
            : err?.code === 2
              ? 'Location unavailable on this device.'
              : 'Could not get your location.'
        toast.error(msg + ' You can use the manual options below.')
      },
      { timeout: 7000 }
    )
  }

  const useDhakaTestLocation = () => {
    setUserLocation(DHAKA_DEFAULT.lat, DHAKA_DEFAULT.lng)
    setLocationStatus('granted')
    toast.success('Using Dhaka (Gulshan) as delivery location')
  }

  const submitManualLocation = (e) => {
    e.preventDefault()
    const lat = parseFloat(manualLat)
    const lng = parseFloat(manualLng)
    if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error('Please enter a valid latitude (-90..90) and longitude (-180..180).')
      return
    }
    setUserLocation(lat, lng)
    setLocationStatus('granted')
    setShowManualForm(false)
    toast.success(`Using ${lat.toFixed(4)}, ${lng.toFixed(4)} as delivery location`)
  }

  const handleClearCart = () => {
    clearCart()
    toast.success('Cart cleared.')
  }

  const handlePlaceOrder = async () => {
    if (!items.length) return
    if (!Number.isFinite(userLocation?.lat) || !Number.isFinite(userLocation?.lng)) {
      toast.error('Please set your delivery location before ordering.')
      return
    }

    setPlacingOrder(true)
    try {
      const payload = {
        items: items.map((i) => ({
          menuItemId: i.menuItemId,
          restaurantId: i.restaurantId,
          quantity: i.quantity,
        })),
        restaurantIds: [...new Set(items.map((i) => i.restaurantId))],
        userLat: userLocation.lat,
        userLng: userLocation.lng,
        isCluster: Boolean(clusterStatus?.eligible),
      }
      const result = await placeOrder(payload)
      clearCart()
      toast.success(`Order placed — ID ${String(result.orderId).slice(0, 8).toUpperCase()}`)
      navigate(`/orders/${result.orderId}`)
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Couldn't place your order. Please try again."
      )
    } finally {
      setPlacingOrder(false)
    }
  }

  // ─── Empty cart state ───────────────────────────────────────────────────
  if (!items.length) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <span className="text-6xl">🛒</span>
        <h2 className="text-2xl font-black text-foreground">Your cart is empty</h2>
        <p className="text-muted-foreground text-sm">Add food from the home page to get started.</p>
        <Button asChild className="mt-2">
          <Link to="/home">Browse Food</Link>
        </Button>
      </div>
    )
  }

  const restaurantGroups = Object.values(itemsByRestaurant)

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-foreground">Your Cart</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {itemCount} item{itemCount !== 1 ? 's' : ''} from{' '}
              {restaurantGroups.length} restaurant
              {restaurantGroups.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={handleClearCart}
              className="text-xs text-destructive/70 hover:text-destructive font-medium transition-colors"
          >
            Clear cart
          </button>
        </div>

        {/* ─── Location controls ──────────────────────────────────────────── */}
        {locationStatus !== 'granted' ? (
          <Card className="mb-4 border-border bg-card p-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-foreground">📍 Set your delivery location</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Required to check cluster eligibility, calculate delivery fee, and
                show your estimated delivery time.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={requestLocation}
                disabled={locationStatus === 'loading'}
                size="sm"
                className="text-xs"
              >
                {locationStatus === 'loading' ? 'Getting GPS…' : 'Use my GPS'}
              </Button>
              <Button
                type="button"
                onClick={() => setShowMapPicker(true)}
                size="sm"
                className="text-xs"
              >
                🗺️ Pick on map
              </Button>
              {import.meta.env.DEV && (
                <Button
                  type="button"
                  onClick={useDhakaTestLocation}
                  size="sm"
                  variant="secondary"
                  className="text-xs"
                >
                  Use Dhaka (test)
                </Button>
              )}
              <Button
                type="button"
                onClick={() => setShowManualForm((v) => !v)}
                size="sm"
                variant="outline"
                className="text-xs"
              >
                Enter coordinates
              </Button>
            </div>

            {showManualForm && (
              <form
                onSubmit={submitManualLocation}
                className="flex flex-wrap items-end gap-2 pt-2 border-t border-border"
              >
                <label className="text-xs font-semibold text-foreground">
                  Latitude
                  <Input
                    type="number"
                    step="any"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    placeholder="23.7808"
                    className="block w-32 mt-0.5"
                  />
                </label>
                <label className="text-xs font-semibold text-foreground">
                  Longitude
                  <Input
                    type="number"
                    step="any"
                    value={manualLng}
                    onChange={(e) => setManualLng(e.target.value)}
                    placeholder="90.4154"
                    className="block w-32 mt-0.5"
                  />
                </label>
                <Button
                  type="submit"
                  size="sm"
                  className="text-xs"
                >
                  Apply
                </Button>
              </form>
            )}
          </Card>
        ) : (
          <Card className="mb-4 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-primary">
              ✅ Delivery location set: {userLocation.lat.toFixed(4)},{' '}
              {userLocation.lng.toFixed(4)}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => setShowMapPicker(true)}
                size="sm"
                variant="outline"
                className="text-xs"
              >
                🗺️ Edit on map
              </Button>
              <Button
                type="button"
                onClick={() => setLocationStatus('idle')}
                variant="link"
                className="text-xs"
              >
                Change
              </Button>
            </div>
          </Card>
        )}

        {/* Cluster banner (only when 2+ restaurants in cart) */}
        {restaurantGroups.length > 1 && (
          <div className="mb-5">
            <ClusterBanner clusterStatus={clusterStatus} checkingCluster={checkingCluster} />
          </div>
        )}

        {/* Restaurant sections */}
        <div className="space-y-4 mb-6">
          {restaurantGroups.map(({ restaurantId, restaurantName, items: groupItems }) => (
            <div
              key={restaurantId}
              className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-muted/30">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white font-black text-sm">
                  {restaurantName?.[0] || '?'}
                </div>
                <span className="font-semibold text-foreground text-sm">{restaurantName}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {groupItems.length} item{groupItems.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="px-4 divide-y divide-border">
                {groupItems.map((item) => (
                  <CartItem key={item.menuItemId} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Order summary — shows ETA via CartSummary */}
        <CartSummary
          subtotal={subtotal}
          clusterStatus={clusterStatus}
          onPlaceOrder={handlePlaceOrder}
          placingOrder={placingOrder}
        />
      </div>

      {/*
        Map picker modal — LocationPickerMap is self-contained (renders its
        own overlay + header + presets + confirm footer). We just toggle it
        open and handle the confirmed pick.
      */}
      <LocationPickerMap
        isOpen={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        initialLocation={mapPickerInitialLocation}
        onConfirm={async (picked) => {
          setUserLocation(picked.lat, picked.lng)
          setLocationStatus('granted')
          if (user?.role === 'user') {
            try {
              await updateSavedDeliveryLocation({ lat: picked.lat, lng: picked.lng })
              await fetchuser()
              toast.success('Delivery location saved to your profile')
            } catch {
              toast.error('Could not save location to your profile')
              return
            }
          } else {
            toast.success(
              `Location set: ${picked.lat.toFixed(4)}, ${picked.lng.toFixed(4)}`
            )
          }
        }}
      />
    </div>
  )
}

export default Cart
