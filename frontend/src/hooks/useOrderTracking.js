// frontend/src/hooks/useOrderTracking.js
// ─────────────────────────────────────────────────────────────────────────────
// Member 1 — Live Order Tracking (single-order view)
//
// Manages the full state of the /orders/:id tracking page:
//   • Fetches tracking details + status history on mount
//   • Subscribes to realtime UPDATEs on the specific order row
//   • Subscribes to realtime INSERTs on order_status_history for this order
//   • Exposes a refresh() helper for manual refetches
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabase'
import { getTrackingDetails, getStatusHistory } from '../services/orderTrackingService'

const useOrderTracking = (orderId) => {
  const [tracking, setTracking] = useState(null) // { order, items, cluster, rider }
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const POLL_FALLBACK_MS = 30_000

  const refresh = useCallback(async () => {
    if (!orderId) return
    try {
      setError(null)
      const [details, hist] = await Promise.all([
        getTrackingDetails(orderId),
        getStatusHistory(orderId).catch(() => []), // history is best-effort
      ])
      setTracking(details)
      setHistory(hist)
    } catch (err) {
      setError(err)
      console.error('useOrderTracking refresh failed:', err)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  // Initial load
  useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh])

  // Realtime — listen for updates to THIS order
  useEffect(() => {
    if (!orderId) return

    const orderChannel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        () => refresh()
      )
      .subscribe()

    // Also listen for new status-history rows for this order
    const historyChannel = supabase
      .channel(`order-history-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_status_history',
          filter: `order_id=eq.${orderId}`,
        },
        () => refresh()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(orderChannel)
      supabase.removeChannel(historyChannel)
    }
  }, [orderId, refresh])

  // Refresh when tab becomes visible (helps after backgrounding)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [refresh])

  // Poll fallback in case realtime is blocked
  useEffect(() => {
    if (!orderId) return
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, POLL_FALLBACK_MS)
    return () => clearInterval(intervalId)
  }, [orderId, refresh])

  return {
    tracking,
    history,
    loading,
    error,
    refresh,
  }
}

export default useOrderTracking
