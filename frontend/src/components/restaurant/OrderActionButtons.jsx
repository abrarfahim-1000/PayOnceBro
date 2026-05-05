import { useState } from 'react'
import { updateOrderStatus } from '../../services/restaurantService'

/**
 * Shows contextual action buttons based on the current order status.
 *
 * pending   → Accept / Reject
 * accepted  → Mark Preparing / Reject
 * preparing → Mark for delivery
 */
const OrderActionButtons = ({ order, onStatusChange }) => {
  const [loading, setLoading] = useState(false)

  const handle = async (status) => {
    setLoading(true)
    try {
      await updateOrderStatus(order.id, status)
      onStatusChange()
    } catch (err) {
      console.error('Status update failed:', err)
    } finally {
      setLoading(false)
    }
  }

  if (order.status === 'pending') {
    return (
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => handle('accepted')}
          disabled={loading}
          className="flex-1 py-1.5 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          Accept
        </button>
        <button
          onClick={() => handle('rejected')}
          disabled={loading}
          className="flex-1 py-1.5 rounded-md bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200 disabled:opacity-50 transition-colors"
        >
          Reject
        </button>
      </div>
    )
  }

  if (order.status === 'accepted') {
    return (
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => handle('preparing')}
          disabled={loading}
          className="flex-1 py-1.5 rounded-md bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          Mark Preparing
        </button>
        <button
          onClick={() => handle('rejected')}
          disabled={loading}
          className="py-1.5 px-3 rounded-md bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          Reject
        </button>
      </div>
    )
  }

  if (order.status === 'preparing') {
    return (
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => handle('pickup')}
          disabled={loading}
          className="flex-1 py-1.5 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          Assign to rider
        </button>
      </div>
    )
  }

  return null
}

export default OrderActionButtons
