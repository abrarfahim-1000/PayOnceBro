import * as menuModel from '../models/menuModel.js'
import * as restaurantModel from '../models/restaurantModel.js'
import { findClusters, sortByProximity } from '../services/clusteringService.js'
import { haversineDistance } from '../utils/geoUtils.js'

const MAP_CLUSTER_PALETTE = ['#059669', '#7c3aed', '#ea580c', '#0284c7', '#ca8a04']

/**
 * GET /api/search
 * Query params: q, minPrice, maxPrice, cuisine, userLat, userLng
 *
 * This is the "search controller". Think of it as the middleman:
 * 1. It receives the user's search request
 * 2. It asks the menuModel to find matching food
 * 3. It sorts results by proximity (nearby restaurants first)
 * 4. It sends the results back to the frontend
 */
export const search = async (req, res, next) => {
  try {
    const { q = '', minPrice, maxPrice, cuisine, userLat, userLng, limit, offset } = req.query

    const pageLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100)
    const pageOffset = Math.min(Math.max(parseInt(offset, 10) || 0, 0), 10_000)

    const { items: rawItems, meta } = await menuModel.searchItems(q, {
      minPrice,
      maxPrice,
      cuisine,
      limit: pageLimit,
      offset: pageOffset,
    })

    // Step 2: Add distance info if user's location was provided
    const userLatNum = parseFloat(userLat)
    const userLngNum = parseFloat(userLng)
    const hasLocation = !isNaN(userLatNum) && !isNaN(userLngNum)

    // Step 3: Enrich each item with distance and cluster eligibility
    const CLUSTER_RADIUS_KM = parseFloat(process.env.CLUSTER_RADIUS_KM) || 2

    const enriched = rawItems.map((item) => {
      const restaurant = item.restaurants
      let distanceKm = null
      let isClusterEligible = false

      if (hasLocation && restaurant?.lat != null && restaurant?.lng != null) {
        distanceKm = haversineDistance(
          userLatNum,
          userLngNum,
          restaurant.lat,
          restaurant.lng
        )
        // "Cluster eligible" means the restaurant is close enough that
        // ordering from it together with another nearby restaurant gives
        // the customer a discount on delivery fee!
        isClusterEligible = distanceKm <= CLUSTER_RADIUS_KM
      }

      return {
        menuItem: {
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          category: item.category,
          aiTags: item.ai_tags ?? [],
          restaurantId: item.restaurant_id,
        },
        restaurant: {
          id: restaurant?.id,
          name: restaurant?.name,
          address: restaurant?.address,
          lat: restaurant?.lat,
          lng: restaurant?.lng,
          avgRating: restaurant?.avg_rating,
          avgPrepTime: restaurant?.avg_prep_time,
        },
        distanceKm,
        isClusterEligible,
      }
    })

    // Step 4: Sort via clustering service to keep ordering logic centralized.
    const sorted = hasLocation
      ? sortByProximity(enriched, userLatNum, userLngNum)
      : [...enriched].sort((a, b) => a.menuItem.price - b.menuItem.price)

    res.json({
      results: sorted,
      total: sorted.length,
      hasMore: Boolean(meta?.hasMore),
      nextOffset: meta?.nextOffset ?? pageOffset + sorted.length,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/search/categories
 * Returns all available food categories for the filter dropdown.
 */
export const getCategories = async (req, res, next) => {
  try {
    const categories = await menuModel.getCategories()
    res.json({ categories })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/search/map
 * Active restaurants with lat/lng for the location-picker map, plus cluster
 * polylines using the same findClusters logic as the rest of the app.
 */
export const getSearchMap = async (req, res, next) => {
  try {
    const radiusKm = parseFloat(process.env.CLUSTER_RADIUS_KM) || 2
    const all = await restaurantModel.getAllActive()
    const clusters = findClusters(all, radiusKm)

    const restaurantClusterIndex = new Map()
    clusters.forEach((c, idx) => {
      c.restaurants.forEach((r) => {
        if (r?.id) restaurantClusterIndex.set(r.id, idx)
      })
    })

    const restaurants = all.map((r) => ({
      id: r.id,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      avgRating: r.avg_rating ?? null,
      address: r.address ?? null,
      clusterIndex: restaurantClusterIndex.has(r.id) ? restaurantClusterIndex.get(r.id) : null,
    }))

    const clusterPolylines = clusters.map((c, idx) => ({
      key: `cluster-${idx}`,
      color: MAP_CLUSTER_PALETTE[idx % MAP_CLUSTER_PALETTE.length],
      positions: c.restaurants
        .filter((r) => r.lat != null && r.lng != null)
        .map((r) => [Number(r.lat), Number(r.lng)]),
    }))

    res.json({
      restaurants,
      clusterPolylines,
      clusterRadiusKm: radiusKm,
    })
  } catch (err) {
    next(err)
  }
}
