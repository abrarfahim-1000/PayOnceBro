import supabase from '../config/db.js'

export const create = async (restaurantIds = []) => {
  const { data, error } = await supabase
    .from('clusters')
    .insert({ restaurant_ids: restaurantIds, is_active: true })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export const getById = async (clusterId) => {
  if (!clusterId) return null

  const { data, error } = await supabase
    .from('clusters')
    .select('*')
    .eq('id', clusterId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export const assignRider = async (clusterId, riderId) => {
  const { data, error } = await supabase
    .from('clusters')
    .update({ rider_id: riderId, is_active: true })
    .eq('id', clusterId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export const updateRestaurantIds = async (clusterId, restaurantIds = []) => {
  const { data, error } = await supabase
    .from('clusters')
    .update({ restaurant_ids: restaurantIds })
    .eq('id', clusterId)
    .select('*')
    .single()

  if (error) throw error
  return data
}
