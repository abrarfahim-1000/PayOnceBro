import { useEffect, useState } from 'react'
import supabase from '../lib/supabase'

/**
 * useRiderNotifications — Real-time notifications via Supabase subscription.
 * Returns: { notifications, markAsRead, unreadCount, isLoading }
 */
const useRiderNotifications = (userId) => {
  const [notifications, setNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    let mounted = true

    const fetchInitial = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('id, message, type, is_read, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20)

        if (error) throw error
        if (mounted) {
          setNotifications(data || [])
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    fetchInitial()

    const channel = supabase
      .channel(`notifications:user_id=eq.${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!mounted) return

          if (payload.eventType === 'INSERT') {
            setNotifications((prev) => [payload.new, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setNotifications((prev) =>
              prev.map((n) => (n.id === payload.new.id ? payload.new : n))
            )
          } else if (payload.eventType === 'DELETE') {
            setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [userId])

  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)

      if (error) throw error

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      )
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return { notifications, markAsRead, unreadCount, isLoading }
}

export default useRiderNotifications
