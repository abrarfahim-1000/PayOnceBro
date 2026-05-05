import supabase from '../config/db.js'

const STATUS_VALUES = ['pending', 'accepted', 'preparing', 'pickup', 'rejected']

export const createForOrder = async (orderId, restaurantIds = []) => {
  if (!orderId || !Array.isArray(restaurantIds) || restaurantIds.length === 0) return []

  const payload = restaurantIds.map((restaurantId) => ({
    order_id: orderId,
    restaurant_id: restaurantId,
    status: 'pending',
  }))

  const { data, error } = await supabase
    .from('sub_orders')
    .insert(payload)
    .select('*')

  if (error) throw error
  return data ?? []
}

export const getByOrder = async (orderId) => {
  if (!orderId) return []

  const { data, error } = await supabase
    .from('sub_orders')
    .select('*')
    .eq('order_id', orderId)

  if (error) throw error
  return data ?? []
}

export const getByOrderAndRestaurant = async (orderId, restaurantId) => {
  if (!orderId || !restaurantId) return null

  const { data, error } = await supabase
    .from('sub_orders')
    .select('*')
    .eq('order_id', orderId)
    .eq('restaurant_id', restaurantId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data ?? null
}

export const getByRestaurant = async (restaurantId) => {
  if (!restaurantId) return []

  const { data, error } = await supabase
    .from('sub_orders')
    .select('*')
    .eq('restaurant_id', restaurantId)

  if (error) throw error
  return data ?? []
}

export const updateStatus = async (subOrderId, status) => {
  if (!STATUS_VALUES.includes(status)) {
    throw new Error(`Invalid sub order status: ${status}`)
  }

  const { data, error } = await supabase
    .from('sub_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', subOrderId)
    .select('*')
    .single()

  if (error) throw error
  return data
}