import { haversineDistance } from '../utils/geoUtils.js'

const BASE_FEE = Number(process.env.BASE_DELIVERY_FEE) || 20
const PER_KM = Number(process.env.PER_KM_RATE) || 10
const DISCOUNT = Number(process.env.CLUSTER_DISCOUNT_RATE) || 0.6
const PER_RESTAURANT_FEE = 10 // Added: small fee per extra stop instead of full base fee

/**
 * Calculates the delivery fee for an order.
 *
 * There are two modes:
 *
 * NON-CLUSTER: Each restaurant is a separate delivery stop. 
 * We charge ONE base fee for the order, plus a small fee for each additional restaurant,
 * plus the distance-based fee for each leg.
 *   Formula: BASE_FEE + ((count-1) * PER_RESTAURANT_FEE) + SUM(distance_km * PER_KM_RATE)
 *
 * CLUSTER: All restaurants are close together, so ONE rider picks up from
 * all of them in a single trip. The user only pays once — based on the
 * farthest restaurant — and gets a discount on top of that.
 *   Formula: BASE_FEE + (max_distance_km * PER_KM_RATE * DISCOUNT_RATE)
 *
 * @param {Array<{id, name, lat, lng}>} restaurants - Restaurants in the order
 * @param {number} userLat  - Customer's latitude
 * @param {number} userLng  - Customer's longitude
 * @param {boolean} isCluster - Whether this is a clustered order
 * @returns {{ fee: number, breakdown: Array, savings: number }}
 */
export const calculate = (restaurants, userLat, userLng, isCluster) => {
  // Calculate each restaurant's distance from the customer
  const distances = restaurants.map((r) => ({
    restaurantId: r.id,
    name: r.name,
    distanceKm: haversineDistance(r.lat, r.lng, userLat, userLng),
  }))

  if (!isCluster) {
    // Shared base fee for the whole order + per-stop fee
    const multiStopBase = BASE_FEE + (Math.max(0, restaurants.length - 1) * PER_RESTAURANT_FEE)
    
    const breakdown = distances.map((d) => ({
      restaurantId: d.restaurantId,
      name: d.name,
      distanceKm: parseFloat(d.distanceKm.toFixed(2)),
      // In non-cluster mode, we still show the distance-based part per restaurant
      distanceFee: parseFloat((d.distanceKm * PER_KM).toFixed(2))
    }))
    
    const totalDistanceFee = breakdown.reduce((sum, b) => sum + b.distanceFee, 0)
    const fee = parseFloat((multiStopBase + totalDistanceFee).toFixed(2))
    
    return { 
      fee, 
      breakdown: breakdown.map(b => ({ ...b, fee: parseFloat((multiStopBase / restaurants.length + b.distanceFee).toFixed(2)) })), 
      savings: 0 
    }
  }

  // Cluster: one rider, one trip, discount applied
  const maxDist = Math.max(...distances.map((d) => d.distanceKm))
  const clusterFee = parseFloat((BASE_FEE + maxDist * PER_KM * DISCOUNT).toFixed(2))
  
  // Savings calculation relative to the OLD "double base fee" logic was even higher, 
  // but let's calculate relative to current non-cluster logic.
  const individualTotal = distances.reduce((s, d) => s + BASE_FEE + d.distanceKm * PER_KM, 0)
  const savings = parseFloat((individualTotal - clusterFee).toFixed(2))

  const breakdown = distances.map((d) => ({
    restaurantId: d.restaurantId,
    name: d.name,
    distanceKm: parseFloat(d.distanceKm.toFixed(2)),
  }))

  return { fee: clusterFee, breakdown, savings }
}
