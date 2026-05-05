// backend/models/riderModel.js
// Data layer — raw Supabase queries only, no business logic

import supabase from '../config/db.js'
const isMissingRow = (error) => error?.code === 'PGRST116'

/**
 * getById — fetch a single rider by ID with all fields.
 * Returns null if rider doesn't exist (instead of throwing).
 */
export const getById = async (id) => {
  const { data, error } = await supabase
    .from('riders')
    .select('*')
    .eq('id', id)
    .single()

  // .single() throws if no rows or > 1 rows — handle gracefully
  if (error) {
    if (isMissingRow(error)) return null
    throw error
  }
  return data
}

/**
 * getByUserId — fetch rider row by authenticated user id.
 */
export const getByUserId = async (userId) => {
  const { data, error } = await supabase
    .from('riders')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (isMissingRow(error)) return null
    throw error
  }
  return data
}

/**
 * getAvailable — fetch all riders with is_available = true.
 * Used by riderAssignmentService to find candidates for a delivery.
 */
export const getAvailable = async () => {
  const { data, error } = await supabase
    .from('riders')
    .select('id, user_id, current_lat, current_lng, is_available, avg_rating, total_deliveries')
    .eq('is_available', true)

  if (error) throw error
  return data ?? []
}

export const getAllWithLocation = async () => {
  const { data, error } = await supabase
    .from('riders')
    .select('id, user_id, current_lat, current_lng, is_available, avg_rating, total_deliveries')
    .not('current_lat', 'is', null)
    .not('current_lng', 'is', null)

  if (error) throw error
  return data ?? []
}

/**
 * updateLocationByUserId — update rider coords using user_id.
 */
export const updateLocationByUserId = async (userId, lat, lng) => {
  const { data, error } = await supabase
    .from('riders')
    .update({
      current_lat: lat,
      current_lng: lng,
    })
    .eq('user_id', userId)
    .select('id, user_id, current_lat, current_lng')
    .single()

  if (error) {
    if (isMissingRow(error)) return null
    throw error
  }
  return data
}

/**
 * setAvailable — mark a rider as available or unavailable.
 * Available = true: ready to accept deliveries
 * Available = false: currently on a delivery, cannot accept more
 */
export const setAvailable = async (riderId, isAvailable) => {
  const { data, error } = await supabase
    .from('riders')
    .update({
      is_available: isAvailable,
    })
    .eq('id', riderId)
    .select('id, is_available')
    .single()

  if (error) throw error
  return data
}

/**
 * getLocation — fetch only the current location of a rider.
 * Returns null if rider doesn't exist.
 */
export const getLocation = async (riderId) => {
  const { data, error } = await supabase
    .from('riders')
    .select('id, current_lat, current_lng')
    .eq('id', riderId)
    .single()

  if (error) {
    if (isMissingRow(error)) return null
    throw error
  }
  return data
}

/**
 * updateStats — increment total_deliveries after successful delivery.
 * This is called by the order controller when an order is marked delivered.
 */
export const updateStats = async (riderId, totalDeliveries) => {
  const { data, error } = await supabase
    .from('riders')
    .update({
      total_deliveries: totalDeliveries,
    })
    .eq('id', riderId)
    .select('total_deliveries')
    .single()

  if (error) throw error
  return data
}

/**
 * updateRating — update rider's average rating after a new rating is submitted.
 * Called by ratingController after creating a new rider rating.
 */
export const updateRating = async (riderId, avgRating) => {
  const { data, error } = await supabase
    .from('riders')
    .update({ avg_rating: avgRating })
    .eq('id', riderId)
    .select('id, avg_rating')
    .single()

  if (error) throw error
  return data
}

export const getByIdsWithProfiles = async (riderIds = []) => {
  if (!Array.isArray(riderIds) || riderIds.length === 0) return []

  const { data: riders, error: riderError } = await supabase
    .from('riders')
    .select('id, user_id')
    .in('id', riderIds)

  if (riderError) throw riderError
  const rows = riders ?? []
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))]

  let profilesById = {}
  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, username, email')
      .in('id', userIds)

    if (profileError) throw profileError
    profilesById = (profiles ?? []).reduce((acc, profile) => {
      acc[profile.id] = profile
      return acc
    }, {})
  }

  const enriched = await Promise.all(
    rows.map(async (rider) => {
      const baseProfile = profilesById[rider.user_id] || null
      let fullName = baseProfile?.full_name || baseProfile?.username || null
      let email = baseProfile?.email || null

      if ((!fullName || !email) && rider.user_id) {
        try {
          const { data, error } = await supabase.auth.admin.getUserById(rider.user_id)
          if (!error && data?.user) {
            const metaName = data.user.user_metadata?.full_name || data.user.user_metadata?.name
            fullName = fullName || metaName || (data.user.email ? data.user.email.split('@')[0] : null)
            email = email || data.user.email || null
          }
        } catch {
          // Best-effort enrichment only.
        }
      }

      return {
        ...rider,
        profile: {
          full_name: fullName,
          email,
        },
      }
    })
  )

  return enriched
}
