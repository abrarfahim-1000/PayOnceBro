// frontend/src/components/rider/StatusButtons.jsx
// Displays status transition buttons for the current order

import { useState } from 'react'
import { useEffect } from 'react'
import api from '../../services/api.js'
import { toast } from 'sonner'

const STATUS_TRANSITIONS = {
  preparing: 'pickup',
  pickup: 'on_the_way',
  on_the_way: 'delivered',
}

/**
 * StatusButtons — Shows the next valid status button for an order.
 * 
 * Props:
 *   - orderId: The order ID to update
 *   - currentStatus: Current order status (e.g., 'pending')
 *   - onStatusUpdate: Callback fired after successful update { order }
 *   - disabled: Boolean to disable buttons
 */
const StatusButtons = ({ orderId, currentStatus, onStatusUpdate, disabled = false }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const nextStatus = STATUS_TRANSITIONS[currentStatus]

  const handleUpdateStatus = async () => {
    if (!nextStatus) return

    setLoading(true)
    setError(null)

    try {
      const { data } = await api.put(`/orders/${orderId}/status`, {
        status: nextStatus,
      })

      toast.success(`Order status updated to ${nextStatus.replace('_', ' ')}.`)

      // Emit success event with updated order
      if (onStatusUpdate) {
        onStatusUpdate(data?.order ?? data)
      }
    } catch (err) {
      console.error('Status update failed:', err)
      setError(err.response?.data?.message || 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!error) return
    toast.error(error, { id: `error-${error}` })
  }, [error])

  if (!nextStatus) {
    const message =
      currentStatus === 'accepted'
        ? 'Waiting for restaurant to start preparing'
        : currentStatus === 'delivered'
          ? 'Order completed'
          : 'Order in final state'

    return (
      <div className="flex items-center justify-center p-4 bg-gray-50 rounded">
        <span className="text-sm text-gray-600">
          {message}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          onClick={handleUpdateStatus}
          disabled={disabled || loading}
          className={`flex-1 px-4 py-2 rounded font-medium text-white transition-all ${
            disabled || loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Updating...
            </span>
          ) : (
            `Mark as ${nextStatus.replace('_', ' ')}`
          )}
        </button>
      </div>

    </div>
  )
}

export default StatusButtons
