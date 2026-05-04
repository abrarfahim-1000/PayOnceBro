// frontend/src/pages/user/Orders.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Member 1 — Feature 5: Live Order Tracking (list view)
//
// Upgrades from the previous version:
//   • Realtime: uses useUserOrders which subscribes to Supabase order changes
//   • Inline progress bar for every in-progress order
//   • Live ETA countdown pill
//   • "Track order" link routing to /orders/:id (detail page)
//   • Filter tabs: Active / Delivered / All
//
// **Preserved unchanged from the previous file (Member 2's rider rating flow):**
//   • RatingModal import + integration for delivered orders
//   • The dismiss button ("✕") next to "Rate Rider"
//   • The dismissedOrders Set
//   • handleRateRider / handleRatingSubmitted / handleDismissRating
//
// NOTHING in Member 2's code is touched — we only consume their modal.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import useUserOrders from '../../hooks/useUserOrders'
import OrderProgressBar from '../../components/user/OrderProgressBar'
import OrderETABadge from '../../components/user/OrderETABadge'
import RatingModal from '../../components/user/RatingModal' // Member 2's component — unchanged

const ACTIVE_STATUSES = new Set([
  'pending',
  'accepted',
  'preparing',
  'pickup',
  'on_the_way',
])

const formatStatus = (status) =>
  String(status || '').replaceAll('_', ' ').toUpperCase()

const formatDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

const statusPillColor = (status) => {
  if (status === 'delivered') return 'bg-emerald-100 text-emerald-700'
  if (status === 'cancelled') return 'bg-red-100 text-red-700'
  return 'bg-orange-100 text-orange-700'
}

const Orders = () => {
  const { data: orders, loading, error } = useUserOrders()
  const [filter, setFilter] = useState('active') // 'active' | 'delivered' | 'all'

  // ─── Rating modal state (Member 2 integration — preserved) ─────────────
  const [ratingModal, setRatingModal] = useState({
    isOpen: false,
    orderId: null,
    riderId: null,
  })
  const [dismissedOrders, setDismissedOrders] = useState(new Set())

  const handleRateRider = (orderId, riderId) => {
    setRatingModal({ isOpen: true, orderId, riderId })
  }

  const handleRatingSubmitted = () => {
    toast.success('Thank you for rating!')
    setRatingModal({ isOpen: false, orderId: null, riderId: null })
  }

  const handleDismissRating = (orderId) => {
    setDismissedOrders((prev) => new Set([...prev, orderId]))
  }
  // ────────────────────────────────────────────────────────────────────────

  // Filter orders based on the active tab
  const filteredOrders = useMemo(() => {
    if (!Array.isArray(orders)) return []
    if (filter === 'all') return orders
    if (filter === 'delivered') {
      return orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled')
    }
    // 'active'
    return orders.filter((o) => ACTIVE_STATUSES.has(o.status))
  }, [orders, filter])

  const counts = useMemo(() => {
    if (!Array.isArray(orders)) return { active: 0, delivered: 0, all: 0 }
    return {
      active: orders.filter((o) => ACTIVE_STATUSES.has(o.status)).length,
      delivered: orders.filter(
        (o) => o.status === 'delivered' || o.status === 'cancelled'
      ).length,
      all: orders.length,
    }
  }, [orders])

  // ─── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3 p-4 max-w-3xl mx-auto">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  // ─── Error state ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load your orders. Please refresh the page.
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-3xl mx-auto p-4 pb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900">My Orders</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Live updates — no need to refresh
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 border-b border-gray-200 mb-5">
          {[
            { key: 'active',    label: `Active (${counts.active})` },
            { key: 'delivered', label: `Completed (${counts.delivered})` },
            { key: 'all',       label: `All (${counts.all})` },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                filter === t.key
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {filteredOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <span className="text-5xl mb-3">📦</span>
            <p className="text-sm">
              {filter === 'active'
                ? 'No active orders right now.'
                : filter === 'delivered'
                  ? 'No completed orders yet.'
                  : 'You haven’t placed any orders yet.'}
            </p>
            <Link
              to="/home"
              className="mt-4 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition"
            >
              Browse food
            </Link>
          </div>
        )}

        {/* Order cards */}
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isActive = ACTIVE_STATUSES.has(order.status)
            const showRate =
              order.status === 'delivered' &&
              order.rider_id &&
              !dismissedOrders.has(order.id)

            return (
              <div
                key={order.id}
                className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Top header */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">
                      Order #{String(order.id).slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold rounded-full px-2.5 py-1 ${statusPillColor(order.status)}`}
                  >
                    {formatStatus(order.status)}
                  </span>
                </div>

                {/* Live progress bar + ETA for active orders */}
                {isActive && (
                  <div className="px-4 pt-4 pb-2">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500">Live progress</p>
                      <OrderETABadge order={order} />
                    </div>
                    <OrderProgressBar status={order.status} />
                  </div>
                )}

                {/* Totals */}
                <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
                  <div className="text-gray-600">
                    <span>Total: </span>
                    <span className="font-bold text-gray-900">
                      ৳{Number(order.total_price || 0).toFixed(0)}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">
                      · delivery ৳{Number(order.delivery_fee || 0).toFixed(0)}
                    </span>
                  </div>

                  {/* Track order link for active orders */}
                  {isActive && (
                    <Link
                      to={`/orders/${order.id}`}
                      className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                    >
                      Track order →
                    </Link>
                  )}
                  {order.status === 'delivered' && (
                    <Link
                      to={`/orders/${order.id}`}
                      className="text-sm font-medium text-gray-500 hover:text-gray-800"
                    >
                      View details
                    </Link>
                  )}
                </div>

                {/* Rider details */}
                {order.rider && (
                  <div className="px-4 pb-4 text-xs text-emerald-700">
                    Rider: <span className="font-semibold text-emerald-900">{order.rider.fullName}</span>
                    <span className="ml-2">⭐ {Number(order.rider.avgRating || 0).toFixed(1)}</span>
                  </div>
                )}

                {/* Rate Rider row (Member 2 integration — preserved verbatim behavior) */}
                {showRate && (
                  <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                    <button
                      onClick={() => handleRateRider(order.id, order.rider_id)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 transition"
                    >
                      ⭐ Rate Rider
                    </button>
                    <button
                      onClick={() => handleDismissRating(order.id)}
                      className="text-lg text-gray-500 hover:text-red-500 hover:bg-red-50 rounded px-2 py-1 transition duration-200"
                      title="Dismiss rating"
                      aria-label="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Rating Modal (Member 2's component, unchanged) */}
      <RatingModal
        isOpen={ratingModal.isOpen}
        orderId={ratingModal.orderId}
        riderId={ratingModal.riderId}
        type="rider"
        onClose={() => setRatingModal({ isOpen: false, orderId: null, riderId: null })}
        onDismiss={() => ratingModal.orderId && handleDismissRating(ratingModal.orderId)}
        onSubmit={handleRatingSubmitted}
      />
    </>
  )
}

export default Orders
