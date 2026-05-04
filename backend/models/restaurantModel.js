// backend/models/restaurantModel.js
// ─── ADD these two functions to your existing restaurantModel.js ───────────────
// The rest of your existing functions stay exactly as they are.

import supabase from '../config/db.js'

// ─── NEW: needed by clusterController ─────────────────────────────────────────

/**
 * getByIds — fetch multiple restaurants by their IDs in one query.
 * Used by checkCluster and getDeliveryFee to get lat/lng for calculations.
 *
 * Returns only the fields the clustering logic needs.
 */
export const getByIds = async (ids) => {
  if (!ids || ids.length === 0) return []

  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, lat, lng, avg_prep_time, avg_rating, address')
    .in('id', ids)
    .eq('is_active', true)

  if (error) throw error
  return data ?? []
}

/**
 * getAllActive — fetch ALL active restaurants.
 * Used by getNearbyClusters to find all possible clusters near a user.
 *
 * Only returns restaurants that have lat/lng set — restaurants without
 * coordinates cannot participate in distance-based clustering.
 */
export const getAllActive = async () => {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, lat, lng, avg_prep_time, avg_rating, address, cuisine')
    .eq('is_active', true)
    .not('lat', 'is', null)    // only restaurants with location data
    .not('lng', 'is', null)

  if (error) throw error
  return data ?? []
}

// ─── EXISTING functions below — keep as-is ────────────────────────────────────

export const createRestaurant = async (ownerId, fields) => {
  const { data, error } = await supabase
    .from('restaurants')
    .insert({ ...fields, owner_id: ownerId })
    .select()
    .single()
  if (error) throw error
  return data
}

export const getByOwner = async (ownerId) => {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('owner_id', ownerId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export const getOrderItemsByRestaurant = async (restaurantId) => {
  const { data, error } = await supabase
    .from('order_items')
    .select(`
      id,
      order_id,
      quantity,
      price_at_order,
      menu_items (id, name, category)
    `)
    .eq('restaurant_id', restaurantId)
  if (error) throw error
  return data ?? []
}

export const getActiveOrdersByIds = async (orderIds) => {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, total_price, delivery_fee, estimated_time, cluster_id, rider_id, created_at')
    .in('id', orderIds)
    .in('status', ['pending', 'accepted', 'preparing', 'pickup'])
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export const getCompletedOrdersByIds = async (orderIds) => {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, total_price, delivery_fee, estimated_time, cluster_id, rider_id, created_at')
    .in('id', orderIds)
    .eq('status', 'delivered')
    .gte('created_at', todayStart.toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export const getClustersByIds = async (clusterIds) => {
  const { data, error } = await supabase
    .from('clusters')
    .select('id, restaurant_ids, is_active')
    .in('id', clusterIds)
  if (error) throw error
  return data ?? []
}

export const getOrderById = async (orderId) => {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, cluster_id')
    .eq('id', orderId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}

export const updateOrderStatus = async (orderId, status) => {
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select()
    .single()
  if (error) throw error
  return data
}

export const getMenuItems = async (restaurantId) => {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('category', { ascending: true })
  if (error) throw error
  return data ?? []
}

export const createMenuItem = async (restaurantId, item) => {
  const { data, error } = await supabase
    .from('menu_items')
    .insert({ ...item, restaurant_id: restaurantId })
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateMenuItem = async (restaurantId, itemId, updates) => {
  const { data, error } = await supabase
    .from('menu_items')
    .update(updates)
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteMenuItem = async (restaurantId, itemId) => {
  const { error } = await supabase
    .from('menu_items')
    .delete()
    .eq('id', itemId)
    .eq('restaurant_id', restaurantId)
  if (error) throw error
}

export const updateRestaurantSettings = async (restaurantId, settings) => {
  const { data, error } = await supabase
    .from('restaurants')
    .update(settings)
    .eq('id', restaurantId)
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateRestaurantProfile = async (restaurantId, fields) => {
  const { data, error } = await supabase
    .from('restaurants')
    .update(fields)
    .eq('id', restaurantId)
    .select()
    .single()
  if (error) throw error
  return data
}