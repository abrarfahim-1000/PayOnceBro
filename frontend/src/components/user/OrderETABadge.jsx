// frontend/src/components/user/OrderETABadge.jsx
// ─────────────────────────────────────────────────────────────────────────────
// A small pill that shows how many minutes are left until the estimated
// delivery time. Uses the `estimated_time` column (total minutes) from the
// order row, plus the `created_at` timestamp.
//
// Updates every 30 seconds on its own so the number feels live.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'

const TICK_MS = 30_000 // refresh every 30 seconds

const OrderETABadge = ({ order, now: nowProp }) => {
  const shouldSelfTick = nowProp == null
  const [internalNow, setInternalNow] = useState(() => Date.now())

  useEffect(() => {
    if (!shouldSelfTick) return
    const id = setInterval(() => setInternalNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [shouldSelfTick])

  const now = useMemo(
    () => (Number.isFinite(nowProp) ? nowProp : internalNow),
    [nowProp, internalNow]
  )

  if (!order) return null
  if (order.status === 'delivered' || order.status === 'cancelled') return null

  const estimatedTotalMin = Number(order.estimated_time ?? 0)
  const createdAt = order.created_at ? new Date(order.created_at).getTime() : null

  if (!estimatedTotalMin || !createdAt) {
    return (
      <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-600 px-3 py-1 text-xs font-semibold">
        <span>⏱</span>
        <span>ETA pending</span>
      </div>
    )
  }

  const targetAt = createdAt + estimatedTotalMin * 60_000
  const minutesLeft = Math.round((targetAt - now) / 60_000)

  if (minutesLeft <= 0) {
    return (
      <div className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 px-3 py-1 text-xs font-semibold">
        <span>⏱</span>
        <span>Arriving any moment</span>
      </div>
    )
  }

  const color =
    minutesLeft <= 5
      ? 'bg-orange-100 text-orange-700'
      : minutesLeft <= 15
        ? 'bg-amber-100 text-amber-700'
        : 'bg-emerald-100 text-emerald-700'

  return (
    <div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
      <span>⏱</span>
      <span>
        ~{minutesLeft} min{minutesLeft !== 1 ? 's' : ''} left
      </span>
    </div>
  )
}

export default OrderETABadge
