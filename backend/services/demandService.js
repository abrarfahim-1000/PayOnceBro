import supabase from '../config/db.js'
import { haversineDistance } from '../utils/geoUtils.js'

/**
 * In-memory store for demand zones. Updated every 30 minutes.
 * Format: { 'lat,lng': { lat, lng, orderCount, level, lastUpdated } }
 */
const demandZonesStore = new Map()

const GRID_PRECISION = 2 // 0.01 degrees ~ 1km
const HIGH_DEMAND_THRESHOLD = 2
const DEMAND_LOOKBACK_HOURS = 2
const RIDER_PROXIMITY_KM = 1

/**
 * Analyze order density and detect high-demand zones.
 * Called every 30 minutes from app.js background job.
 */
export const analyzeZones = async () => {
  try {
    console.log('📊 Starting demand zone analysis...')

    const lookbackDate = new Date()
    lookbackDate.setHours(lookbackDate.getHours() - DEMAND_LOOKBACK_HOURS)

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, user_lat, user_lng, status, delivered_at, rider_id')
      .eq('status', 'delivered')
      .gte('delivered_at', lookbackDate.toISOString())
      .not('user_lat', 'is', null)
      .not('user_lng', 'is', null)

    if (error) {
      console.error('❌ Error fetching orders for demand analysis:', error)
      return
    }

    if (!orders || orders.length === 0) {
      console.log('⚠️ No delivered orders in past 2 hours')
      demandZonesStore.clear()
      return
    }

    const zoneMap = new Map()

    ;(orders ?? []).forEach((order) => {
      const lat = parseFloat(order.user_lat)
      const lng = parseFloat(order.user_lng)
      if (isNaN(lat) || isNaN(lng)) return

      const gridKey = `${lat.toFixed(GRID_PRECISION)},${lng.toFixed(GRID_PRECISION)}`

      if (!zoneMap.has(gridKey)) {
        zoneMap.set(gridKey, {
          lat: parseFloat(lat.toFixed(GRID_PRECISION)),
          lng: parseFloat(lng.toFixed(GRID_PRECISION)),
          orderCount: 0,
        })
      }

      const zone = zoneMap.get(gridKey)
      zone.orderCount += 1
    })

    const newZones = new Map()

    zoneMap.forEach((zone, gridKey) => {
      const level = zone.orderCount >= HIGH_DEMAND_THRESHOLD ? 'HIGH_DEMAND' : 'NORMAL_DEMAND'
      newZones.set(gridKey, {
        lat: zone.lat,
        lng: zone.lng,
        orderCount: zone.orderCount,
        level,
        lastUpdated: new Date().toISOString(),
      })
    })

    demandZonesStore.clear()
    newZones.forEach((value, key) => demandZonesStore.set(key, value))

    console.log(
      `✅ Demand analysis complete. Found ${newZones.size} zones (${[...newZones.values()].filter((z) => z.level === 'HIGH_DEMAND').length} high-demand)`
    )

    await notifyRidersNearDemandZones()
  } catch (err) {
    console.error('❌ Demand analysis error:', err)
  }
}

/**
 * Notify riders who are near high-demand zones.
 */
export const notifyRidersNearDemandZones = async () => {
  try {
    const { data: riders, error: riderError } = await supabase
      .from('riders')
      .select('id, user_id, current_lat, current_lng, is_available')
      .eq('is_available', true)
      .not('current_lat', 'is', null)
      .not('current_lng', 'is', null)

    if (riderError) throw riderError
    if (!riders || riders.length === 0) return

    const highDemandZones = [...demandZonesStore.values()].filter(
      (z) => z.level === 'HIGH_DEMAND'
    )

    if (highDemandZones.length === 0) {
      console.log('ℹ️ No high-demand zones detected')
      return
    }

    const notificationsCreated = []

    for (const rider of riders) {
      const riderLat = parseFloat(rider.current_lat)
      const riderLng = parseFloat(rider.current_lng)
      if (isNaN(riderLat) || isNaN(riderLng)) continue

      for (const zone of highDemandZones) {
        const distance = haversineDistance(riderLat, riderLng, zone.lat, zone.lng)

        if (distance <= RIDER_PROXIMITY_KM) {
          const message = `🔥 High demand detected ${distance.toFixed(1)}km away (${zone.orderCount} orders) — consider repositioning here!`

          const { data: notification, error: notifError } = await supabase
            .from('notifications')
            .insert({
              user_id: rider.user_id,
              message,
              type: 'high_demand_zone',
              is_read: false,
            })
            .select('*')

          if (!notifError && notification) {
            notificationsCreated.push({
              riderId: rider.id,
              message,
              distance: distance.toFixed(2),
            })
          }

          break
        }
      }
    }

    if (notificationsCreated.length > 0) {
      console.log(`📲 Created ${notificationsCreated.length} demand zone notifications`)
    }
  } catch (err) {
    console.error('❌ Error notifying riders:', err)
  }
}

/**
 * Get all current demand zones (for admin heatmap).
 */
export const getDemandZones = () => {
  return [...demandZonesStore.values()].map((zone) => ({
    lat: zone.lat,
    lng: zone.lng,
    orderCount: zone.orderCount,
    level: zone.level,
  }))
}
