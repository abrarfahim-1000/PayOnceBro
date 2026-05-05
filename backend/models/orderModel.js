import supabase from '../config/db.js'

export const create = async ({ userId, riderId = null, clusterId = null, status = 'pending', totalPrice, deliveryFee, estimatedTime = null, userLat = null, userLng = null }) => {
  const { data, error } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      rider_id: riderId,
      cluster_id: clusterId,
      status,
      total_price: totalPrice,
      delivery_fee: deliveryFee,
      estimated_time: estimatedTime,
      user_lat: userLat,
      user_lng: userLng,
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export const createItems = async (orderId, items = []) => {
  if (!items.length) return []

  const payload = items.map((i) => ({
    order_id: orderId,
    menu_item_id: i.menuItemId,
    restaurant_id: i.restaurantId,
    quantity: i.quantity,
    price_at_order: i.priceAtOrder,
  }))

  const { data, error } = await supabase
    .from('order_items')
    .insert(payload)
    .select('*')

  if (error) throw error
  return data ?? []
}

export const getById = async (orderId) => {
  const { data, error } = await supabase
    .from('orders')
    .select('id, user_id, rider_id, cluster_id, status, delivered_at, user_lat, user_lng')
    .eq('id', orderId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export const getByUser = async (userId) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export const getByRider = async (riderId, statuses = null) => {
  let query = supabase
    .from('orders')
    .select('id, rider_id, user_id, cluster_id, status, total_price, delivery_fee, estimated_time, user_lat, user_lng, created_at, delivered_at')
    .eq('rider_id', riderId)
    .order('created_at', { ascending: false })

  if (Array.isArray(statuses) && statuses.length > 0) {
    query = query.in('status', statuses)
  }

  const { data, error } = await query

  if (error) throw error
  return data ?? []
}

export const getItemsForOrders = async (orderIds = []) => {
  if (!Array.isArray(orderIds) || orderIds.length === 0) return []

  const { data, error } = await supabase
    .from('order_items')
    .select('order_id, menu_item_id, quantity, price_at_order, restaurant_id, restaurants(id, name, address, lat, lng)')
    .in('order_id', orderIds)

  if (error) throw error
  return data ?? []
}

export const getWithItems = async (orderId) => {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (orderError && orderError.code !== 'PGRST116') throw orderError
  if (!order) return null

  const { data: items, error: itemError } = await supabase
    .from('order_items')
    .select('id, menu_item_id, restaurant_id, quantity, price_at_order')
    .eq('order_id', orderId)

  if (itemError) throw itemError

  return { order, items: items ?? [] }
}

export const deleteItemsByRestaurant = async (orderId, restaurantId) => {
  const { error } = await supabase
    .from('order_items')
    .delete()
    .eq('order_id', orderId)
    .eq('restaurant_id', restaurantId)

  if (error) throw error
}

export const getItemsByOrder = async (orderId) => {
  const { data, error } = await supabase
    .from('order_items')
    .select('menu_item_id, restaurant_id, quantity, price_at_order')
    .eq('order_id', orderId)

  if (error) throw error
  return data ?? []
}

export const updateTotals = async (orderId, { totalPrice, deliveryFee, estimatedTime } = {}) => {
  const payload = {}
  if (totalPrice != null) payload.total_price = totalPrice
  if (deliveryFee != null) payload.delivery_fee = deliveryFee
  if (estimatedTime != null) payload.estimated_time = estimatedTime

  const { data, error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', orderId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export const updateStatus = async (orderId, status) => {
  const payload = { status }
  if (status === 'delivered') payload.delivered_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', orderId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export const updateRider = async (orderId, riderId) => {
  const { data, error } = await supabase
    .from('orders')
    .update({ rider_id: riderId })
    .eq('id', orderId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export const isOwnedByRestaurantOwner = async (orderId, ownerId) => {
  const { data, error } = await supabase
    .from('order_items')
    .select('id, restaurants!inner(owner_id)')
    .eq('order_id', orderId)
    .eq('restaurants.owner_id', ownerId)
    .limit(1)

  if (error) throw error
  return (data ?? []).length > 0
}

export const getRestaurantIds = async (orderId) => {
  const { data, error } = await supabase
    .from('order_items')
    .select('restaurant_id')
    .eq('order_id', orderId)

  if (error) throw error
  return [...new Set((data ?? []).map((r) => r.restaurant_id).filter(Boolean))]
}

export const insertStatusHistory = async (orderId, status, changedBy) => {
  const { error } = await supabase
    .from('order_status_history')
    .insert({
      order_id: orderId,
      status,
      changed_by: changedBy,
    })

  if (error) throw error
}

export const getDeliveredOrderIdsByUser = async (userId, sinceIso, limit = 200) => {
  if (!userId) return []

  let query = supabase
    .from('orders')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'delivered')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (sinceIso) {
    query = query.gte('created_at', sinceIso)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((r) => r.id).filter(Boolean)
}

export const getDeliveredOrderItemsSince = async (sinceIso, limit = 5000) => {
  let query = supabase
    .from('order_items')
    .select('order_id, menu_item_id, restaurant_id, quantity, price_at_order, orders!inner(status, created_at)')
    .eq('orders.status', 'delivered')
    .order('order_id', { ascending: false })
    .limit(limit)

  if (sinceIso) {
    query = query.gte('orders.created_at', sinceIso)
  }

  const { data, error } = await query
  if (error) throw error

  return data ?? []
}

export const getOrderItemsForOrders = async (orderIds = [], limit = 5000) => {
  if (!Array.isArray(orderIds) || orderIds.length === 0) return []

  const { data, error } = await supabase
    .from('order_items')
    .select('order_id, menu_item_id, restaurant_id, quantity, price_at_order')
    .in('order_id', orderIds)
    .limit(limit)

  if (error) throw error
  return data ?? []
}
