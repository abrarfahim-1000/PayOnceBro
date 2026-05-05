import * as riderModel from '../models/riderModel.js'
import * as orderModel from '../models/orderModel.js'
import * as restaurantModel from '../models/restaurantModel.js'
import * as clusterModel from '../models/clusterModel.js'
import { haversineDistance } from '../utils/geoUtils.js'

const getCentroid = (restaurants = []) => {
  const valid = restaurants.filter((r) => r.lat != null && r.lng != null)
  if (valid.length === 0) return null
  return {
    lat: valid.reduce((s, r) => s + r.lat, 0) / valid.length,
    lng: valid.reduce((s, r) => s + r.lng, 0) / valid.length,
  }
}

export const findBestRider = async (orderId) => {
  try {
    const order = await orderModel.getById(orderId)
    if (!order) {
      console.warn(`Order not found: ${orderId}`)
      return null
    }

    const restaurantIds = await orderModel.getRestaurantIds(orderId)
    console.log(`📍 Finding rider for order ${orderId} with restaurants:`, restaurantIds)

    const restaurants = await restaurantModel.getByIds(restaurantIds)
    const centroid = getCentroid(restaurants)
    if (!centroid) {
      console.warn(`No valid restaurant coordinates for order ${orderId}`)
      return null
    }
    console.log(`📍 Order centroid: lat=${centroid.lat}, lng=${centroid.lng}`)

    let availableRiders = await riderModel.getAvailable()
    console.log(`👥 Available riders: ${availableRiders.length}`)

    if (availableRiders.length === 0) {
      console.warn(`No available riders for order ${orderId}. Falling back to any rider with location.`)
      availableRiders = await riderModel.getAllWithLocation()
    }

    if (availableRiders.length === 0) {
      console.warn(`No riders with location data for order ${orderId}`)
      return null
    }

    const candidates = availableRiders
      .filter((r) => {
        const hasLocation = r.current_lat != null && r.current_lng != null
        if (!hasLocation) {
          console.warn(`Rider ${r.id} skipped: no location data (lat=${r.current_lat}, lng=${r.current_lng})`)
        }
        return hasLocation
      })
      .map((r) => ({
        rider: r,
        distanceKm: haversineDistance(centroid.lat, centroid.lng, r.current_lat, r.current_lng),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)

    console.log(`🎯 Candidate riders for assignment: ${candidates.length}`)

    if (candidates.length === 0) {
      console.warn(`No riders with location data for order ${orderId}`)
      return null
    }

    const chosen = candidates[0].rider
    console.log(`✨ Chose rider ${chosen.id} at distance ${candidates[0].distanceKm.toFixed(3)}km`)

    await orderModel.updateRider(order.id, chosen.id)
    if (order.cluster_id) {
      await clusterModel.assignRider(order.cluster_id, chosen.id)
    }
    await riderModel.setAvailable(chosen.id, false)

    console.log(`✅ Order ${orderId} assigned to rider ${chosen.id}`)
    return {
      riderId: chosen.id,
      distanceKm: Number(candidates[0].distanceKm.toFixed(3)),
    }
  } catch (err) {
    console.error(`❌ Error in findBestRider for order ${orderId}:`, err?.message || err)
    throw err
  }
}
