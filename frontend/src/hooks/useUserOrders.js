// frontend/src/hooks/useUserOrders.js
// ─────────────────────────────────────────────────────────────────────────────
// Member 1 — Live Order Tracking
//
// Fetches the authenticated user's orders AND subscribes to Supabase real-time
// updates so the Orders page stays live without polling.
//
// Pattern mirrors the existing `useRestaurantOrders.js` hook (Member 3's).
// We do NOT touch that hook; we created a parallel one scoped to the user.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import supabase from '../lib/supabase'
import { getMyOrders } from '../services/orderService'

const POLL_FALLBACK_MS = 30_000

const useUserOrders = ({ userId } = {}) => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const userIdKey = useMemo(() => (userId ? String(userId) : null), [userId])
  const inFlightRef = useRef(false)
  const queuedRef = useRef(false)
  const mountedRef = useRef(true)
  const debounceTimerRef = useRef(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimeout(debounceTimerRef.current)
    }
  }, [])

  const requestRefresh = useCallback(() => {
    if (!mountedRef.current) return
    clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      refresh()
    }, 150)
  }, [])

  const refresh = useCallback(async () => {
    try {
      if (inFlightRef.current) {
        queuedRef.current = true
        return
      }
      inFlightRef.current = true
      setError(null)
      const orders = await getMyOrders()
      if (!mountedRef.current) return
      setData(Array.isArray(orders) ? orders : [])
    } catch (err) {
      if (!mountedRef.current) return
      setError(err)
      console.error('useUserOrders refresh failed:', err)
    } finally {
      inFlightRef.current = false
      const isMounted = mountedRef.current
      if (isMounted) {
        setLoading(false)

        if (queuedRef.current) {
          queuedRef.current = false
          requestRefresh()
        }
      }
    }
  }, [])

  // Initial load (and when userId becomes available/changes).
  useEffect(() => {
    if (!userIdKey) return
    setLoading(true)
    setError(null)
    refresh()
  }, [refresh, userIdKey])

  // Realtime subscription — any INSERT/UPDATE on the `orders` table triggers
  // a refresh. The server-side getMyOrders already filters by user_id, so we
  // don't need row-level filtering here.
  useEffect(() => {
    if (!userIdKey) return

    // Scope realtime subscription to this user so other users' order updates
    // don't constantly trigger refreshes.
    const channel = supabase
      .channel(`user-orders-${userIdKey}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${userIdKey}` },
        () => {
          if (document.visibilityState !== 'visible') return
          requestRefresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refresh, userIdKey])

  // Refresh once when the tab becomes visible again.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') requestRefresh()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [requestRefresh])

  // Slow polling fallback (helps if realtime is blocked by network/firewalls).
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') requestRefresh()
    }, POLL_FALLBACK_MS)

    return () => clearInterval(intervalId)
  }, [requestRefresh])

  return { data, loading, error, refresh }
}

export default useUserOrders
