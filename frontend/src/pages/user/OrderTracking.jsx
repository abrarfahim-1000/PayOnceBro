// frontend/src/pages/user/OrderTracking.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Member 1 — Feature 5: Live Order Tracking (detail view)
//
// Route: /orders/:id
//
// This page shows the customer:
//   • A visual progress bar for the current status
//   • A live ETA countdown (minutes remaining)
//   • Order items grouped by restaurant
//   • Fees & totals (with cluster savings highlighted)
//   • A vertical timeline of every status change (from order_status_history)
//   • Rider info once a rider is assigned
//
// Everything is powered by `useOrderTracking` which subscribes to Supabase
// realtime so the page refreshes itself as status changes happen on the
// backend — no manual reload needed.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import useOrderTracking from '../../hooks/useOrderTracking'
import OrderProgressBar from '../../components/user/OrderProgressBar'
import OrderStatusTimeline from '../../components/user/OrderStatusTimeline'
import OrderETABadge from '../../components/user/OrderETABadge'
import RatingModal from '../../components/user/RatingModal'

const formatStatus = (status) =>
  String(status || '').replaceAll('_', ' ').toUpperCase()

const formatDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// Group items by their restaurant for display
const groupItemsByRestaurant = (items = []) => {
  const map = {}
  items.forEach((item) => {
    const rid = item.restaurant?.id || 'unknown'
    const rname = item.restaurant?.name || 'Restaurant'
    if (!map[rid]) map[rid] = { id: rid, name: rname, items: [] }
    map[rid].items.push(item)
  })
  return Object.values(map)
}

const OrderTracking = () => {
  const { id } = useParams()
  const { tracking, history, loading, error } = useOrderTracking(id)
  const [ratingModal, setRatingModal] = useState({
    isOpen: false,
    type: 'restaurant',
    restaurantId: null,
    riderId: null,
  })
  const [hasAutoPrompted, setHasAutoPrompted] = useState(false)
  const [queuedRestaurantId, setQueuedRestaurantId] = useState(null)
  const [ratingSubmitted, setRatingSubmitted] = useState({
    restaurants: {},
    rider: false,
  })

  const order = tracking?.order
  const items = tracking?.items ?? []
  const cluster = tracking?.cluster ?? null
  const rider = tracking?.rider ?? null
  const orderStatus = order?.status
  const orderRiderId = order?.rider_id ?? null
  const restaurantGroups = groupItemsByRestaurant(items)
  const restaurantList = restaurantGroups.filter((group) => group?.id && group.id !== 'unknown')
  const remainingRestaurantRatings = restaurantList.filter(
    (group) => !ratingSubmitted.restaurants[group.id]
  ).length

  const subtotal = items.reduce(
    (sum, i) => sum + Number(i.priceAtOrder || 0) * Number(i.quantity || 0),
    0
  )
  const deliveryFee = Number(order?.delivery_fee || 0)
  const total = Number(order?.total_price || subtotal + deliveryFee)

  useEffect(() => {
    if (orderStatus !== 'delivered' || hasAutoPrompted) return
    setHasAutoPrompted(true)
  }, [orderStatus, hasAutoPrompted])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="h-8 bg-gray-100 rounded animate-pulse w-1/2" />
        <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (error || !tracking || !order) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load this order. It may have been removed, or you may not have access.
        </div>
        <Link
          to="/orders"
          className="inline-block mt-4 text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          ← Back to my orders
        </Link>
      </div>
    )
  }


  return (
    <div className="max-w-3xl mx-auto p-4 pb-10">
      {/* Back link */}
      <Link
        to="/orders"
        className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 mb-4"
      >
        ← Back to my orders
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Order tracking</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            #{String(order.id).slice(0, 8).toUpperCase()} · placed {formatDate(order.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold rounded-full px-3 py-1 ${
              order.status === 'delivered'
                ? 'bg-emerald-100 text-emerald-700'
                : order.status === 'cancelled'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-orange-100 text-orange-700'
            }`}
          >
            {formatStatus(order.status)}
          </span>
          <OrderETABadge order={order} />
        </div>
      </div>

      {/* Cluster badge */}
      {cluster && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-2">
          <span className="text-xl">🔗</span>
          <div>
            <p className="text-sm font-bold text-emerald-800">Cluster delivery</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              One rider is picking up from{' '}
              {Array.isArray(cluster.restaurant_ids)
                ? cluster.restaurant_ids.length
                : restaurantGroups.length}{' '}
              nearby restaurants — you saved on delivery fees!
            </p>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
        <OrderProgressBar status={order.status} />
      </div>

      {/* Rider card */}
      {rider && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-linear-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-black text-lg shrink-0">
            {(rider.fullName || 'R')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{rider.fullName}</p>
            <p className="text-xs text-gray-500">
              Your rider · ⭐ {Number(rider.avgRating || 0).toFixed(1)}
            </p>
            {rider.email && (
              <p className="text-xs text-gray-500 truncate">{rider.email}</p>
            )}
          </div>
          {rider.currentLat && rider.currentLng && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${rider.currentLat},${rider.currentLng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
            >
              View on map
            </a>
          )}
        </div>
      )}

      {/* Items grouped by restaurant */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
        <h3 className="font-bold text-gray-800 text-sm mb-3">What you ordered</h3>
        <div className="space-y-4">
          {restaurantGroups.map((group) => (
            <div key={group.id}>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                {group.name}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      {item.quantity}× {item.name}
                    </span>
                    <span className="font-semibold text-gray-800">
                      ৳{(Number(item.priceAtOrder) * Number(item.quantity)).toFixed(0)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="mt-4 pt-3 border-t border-gray-100 space-y-1 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>৳{subtotal.toFixed(0)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Delivery fee</span>
            <span>৳{deliveryFee.toFixed(0)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-100 font-bold text-gray-900">
            <span>Total</span>
            <span>৳{total.toFixed(0)}</span>
          </div>
        </div>

        {orderStatus === 'delivered' && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm font-bold text-gray-800">Rate your delivery</p>
            <p className="text-xs text-gray-500 mt-1">
              Ratings help restaurants and riders improve.
            </p>
            {restaurantList.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {remainingRestaurantRatings === 0
                  ? 'All restaurants rated. Thank you!'
                  : `${remainingRestaurantRatings} restaurant${remainingRestaurantRatings === 1 ? '' : 's'} left to rate.`}
              </p>
            )}
            <div className="mt-3 flex gap-2 flex-wrap">
              {restaurantList.map((restaurant) => {
                const isRated = Boolean(ratingSubmitted.restaurants[restaurant.id])
                return (
                  <button
                    key={restaurant.id}
                    onClick={() =>
                      setRatingModal({
                        isOpen: true,
                        type: 'restaurant',
                        restaurantId: restaurant.id,
                        riderId: orderRiderId,
                      })
                    }
                    className="px-3 py-2 text-xs font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60"
                    disabled={isRated}
                  >
                    {isRated ? `${restaurant.name} rated` : `Rate ${restaurant.name}`}
                  </button>
                )
              })}
              {orderRiderId && (
                <button
                  onClick={() =>
                    setRatingModal({
                      isOpen: true,
                      type: 'rider',
                      restaurantId: null,
                      riderId: orderRiderId,
                    })
                  }
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={ratingSubmitted.rider}
                >
                  {ratingSubmitted.rider ? 'Rider rated' : 'Rate rider'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status history timeline */}
      <OrderStatusTimeline history={history} />

      <RatingModal
        isOpen={ratingModal.isOpen}
        orderId={order.id}
        restaurantId={ratingModal.restaurantId}
        riderId={ratingModal.riderId}
        type={ratingModal.type}
        onClose={() => {
          if (queuedRestaurantId) {
            setRatingModal({
              isOpen: true,
              type: 'restaurant',
              restaurantId: queuedRestaurantId,
              riderId: orderRiderId,
            })
            setQueuedRestaurantId(null)
            return
          }

          setRatingModal((prev) => ({
            ...prev,
            isOpen: false,
          }))
        }}
        onSubmit={() => {
          if (ratingModal.type === 'restaurant' && ratingModal.restaurantId) {
            const nextRestaurant = restaurantList.find(
              (group) =>
                group.id !== ratingModal.restaurantId &&
                !ratingSubmitted.restaurants[group.id]
            )
            if (nextRestaurant) {
              setQueuedRestaurantId(nextRestaurant.id)
            }
            setRatingSubmitted((prev) => ({
              ...prev,
              restaurants: {
                ...prev.restaurants,
                [ratingModal.restaurantId]: true,
              },
            }))
            return
          }

          if (ratingModal.type === 'rider') {
            setRatingSubmitted((prev) => ({
              ...prev,
              rider: true,
            }))
          }
        }}
      />
    </div>
  )
}

export default OrderTracking
