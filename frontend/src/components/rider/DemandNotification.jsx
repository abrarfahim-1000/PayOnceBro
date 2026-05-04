import { useState } from 'react'

/**
 * DemandNotification — Alert badge showing high-demand zone proximity.
 */
const DemandNotification = ({ notification, onDismiss, onMarkAsRead }) => {
  const [isDismissing, setIsDismissing] = useState(false)

  const handleDismiss = () => {
    setIsDismissing(true)
    if (!notification.is_read && onMarkAsRead) {
      onMarkAsRead(notification.id)
    }
    setTimeout(() => {
      if (onDismiss) {
        onDismiss(notification.id)
      }
    }, 200)
  }

  return (
    <div
      className={`bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-start justify-between gap-3 transition-all duration-200 ${
        isDismissing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
      }`}
    >
      <div className="flex items-start gap-2 flex-1">
        <span className="text-xl mt-0.5" role="img" aria-label="high demand">
          🔥
        </span>
        <div className="flex-1">
          <h4 className="font-semibold text-sm mb-0.5">High Demand Zone Detected</h4>
          <p className="text-xs opacity-95 leading-relaxed">{notification.message}</p>
        </div>
      </div>

      <button
        onClick={handleDismiss}
        className="text-white hover:text-yellow-100 transition-colors flex-shrink-0 mt-0.5"
        aria-label="Dismiss notification"
        title="Dismiss"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default DemandNotification
