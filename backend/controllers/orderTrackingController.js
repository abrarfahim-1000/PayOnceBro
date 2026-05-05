// backend/controllers/orderTrackingController.js
// ─────────────────────────────────────────────────────────────────────────────
// Member 1 — Live Order Tracking
//
// This controller powers the customer's "tracking" experience. It's separate
// from orderController.js (which is shared across Members 1/2/3 for placing
// and updating orders) so we don't touch anyone else's code.
//
// All endpoints here:
//   • Require the caller to be authenticated
//   • Require role === 'user'
//   • Require the order to belong to the authenticated user (user_id check)
//
// Mounted at /api/order-tracking in backend/app.js:
//   GET /api/order-tracking/:id         → getTrackingDetails
//   GET /api/order-tracking/:id/history → getStatusHistory
// ─────────────────────────────────────────────────────────────────────────────

import supabase from '../config/db.js'

// Ensures the order exists AND belongs to the current user.
// Returns the order row on success, or sends the appropriate HTTP response
// and returns null on failure (caller must stop).
const loadOwnedOrder = async (req, res) => {
  const { id } = req.params

  if (!id) {
    res.status(400).json({ message: 'Order id is required' })
    return null
  }

  const { data: order, error } = await supabase
    .from('orders')
    .select(
      'id, user_id, rider_id, cluster_id, status, total_price, delivery_fee, ' +
        'estimated_time, user_lat, user_lng, created_at, delivered_at'
    )
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  if (!order) {
    res.status(404).json({ message: 'Order not found' })
    return null
  }

  if (order.user_id !== req.user.id) {
    res.status(403).json({ message: 'Access denied' })
    return null
  }

  return order
}

/**
 * GET /api/order-tracking/:id
 *
 * Returns everything the user needs to render a tracking page:
 *   - Full order row (status, fees, ETA, timestamps, delivery location)
 *   - Order items joined with menu + restaurant info
 *   - Cluster info if the order was clustered
 *   - Rider info (name, live coordinates) once a rider is assigned
 *
 * Shape:
 * {
 *   order: {...},
 *   items: [{ menu_item_id, name, quantity, price_at_order,
 *             restaurant: { id, name, address, lat, lng } }, ...],
 *   cluster: { id, restaurant_ids, is_active } | null,
 *   rider:   { id, full_name, avg_rating, current_lat, current_lng } | null
 * }
 */
export const getTrackingDetails = async (req, res, next) => {
  try {
    const order = await loadOwnedOrder(req, res)
    if (!order) return // response already sent

    // ── Items + joined menu item + restaurant info ───────────────────────
    const { data: itemRows, error: itemsErr } = await supabase
      .from('order_items')
      .select(
        'id, menu_item_id, restaurant_id, quantity, price_at_order, ' +
          'menu_items ( id, name ), restaurants ( id, name, address, lat, lng )'
      )
      .eq('order_id', order.id)

    if (itemsErr) throw itemsErr

    const items = (itemRows ?? []).map((row) => ({
      id: row.id,
      menuItemId: row.menu_item_id,
      name: row.menu_items?.name ?? 'Item',
      quantity: row.quantity,
      priceAtOrder: Number(row.price_at_order || 0),
      restaurant: row.restaurants
        ? {
            id: row.restaurants.id,
            name: row.restaurants.name,
            address: row.restaurants.address,
            lat: row.restaurants.lat,
            lng: row.restaurants.lng,
          }
        : null,
    }))

    // ── Cluster info (optional) ──────────────────────────────────────────
    let cluster = null
    if (order.cluster_id) {
      const { data, error } = await supabase
        .from('clusters')
        .select('id, restaurant_ids, is_active')
        .eq('id', order.cluster_id)
        .single()
      if (error && error.code !== 'PGRST116') throw error
      cluster = data ?? null
    }

    // ── Rider info (optional) ────────────────────────────────────────────
    let rider = null
    if (order.rider_id) {
      const { data: riderRow, error: riderErr } = await supabase
        .from('riders')
        .select('id, user_id, avg_rating, current_lat, current_lng, is_available')
        .eq('id', order.rider_id)
        .single()

      if (riderErr && riderErr.code !== 'PGRST116') throw riderErr

      if (riderRow) {
        let fullName = 'Rider'
        if (riderRow.user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, username, email')
            .eq('id', riderRow.user_id)
            .single()
          fullName = profile?.full_name || profile?.username || 'Rider'
          rider = {
            id: riderRow.id,
            fullName,
            email: profile?.email || null,
            avgRating: Number(riderRow.avg_rating || 0),
            currentLat: riderRow.current_lat ?? null,
            currentLng: riderRow.current_lng ?? null,
          }
          return res.json({ order, items, cluster, rider })
        }

        rider = {
          id: riderRow.id,
          fullName,
          email: null,
          avgRating: Number(riderRow.avg_rating || 0),
          currentLat: riderRow.current_lat ?? null,
          currentLng: riderRow.current_lng ?? null,
        }
      }
    }

    res.json({ order, items, cluster, rider })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/order-tracking/:id/history
 *
 * Returns the ordered list of status transitions for this order, from the
 * order_status_history table.  This table is already being populated by
 * Member 1/2/3 code paths via orderController.js whenever status changes
 * (we don't touch those writes — we just read).
 *
 * Shape:
 *   { history: [ { id, order_id, status, changed_by, created_at }, ... ] }
 */
export const getStatusHistory = async (req, res, next) => {
  try {
    const order = await loadOwnedOrder(req, res)
    if (!order) return

    // Select * to keep payload forward-compatible; timeline timestamps use
    // created_at as the canonical field.
    const { data, error } = await supabase
      .from('order_status_history')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true })

    if (error) throw error

    res.json({ history: data ?? [] })
  } catch (err) {
    next(err)
  }
}
