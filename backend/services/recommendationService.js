import { haversineDistance } from '../utils/geoUtils.js'
import * as orderModel from '../models/orderModel.js'
import * as menuModel from '../models/menuModel.js'
import * as restaurantModel from '../models/restaurantModel.js'
import { getNearbyClusteredRestaurants } from './clusteringService.js'

const LOOKBACK_DAYS = Number(process.env.RECOMMENDATIONS_LOOKBACK_DAYS) || 90
const MAX_ROWS = Number(process.env.RECOMMENDATIONS_MAX_ROWS) || 5000
const POPULAR_LIMIT = Number(process.env.RECOMMENDATIONS_POPULAR_LIMIT) || 10
const TOGETHER_LIMIT = Number(process.env.RECOMMENDATIONS_TOGETHER_LIMIT) || 8
const CLUSTER_LIMIT = Number(process.env.RECOMMENDATIONS_CLUSTER_LIMIT) || 8

const CLUSTER_RADIUS_KM = Number(process.env.CLUSTER_RADIUS_KM) || 2

const getLookbackStartIso = () => {
  const d = new Date()
  d.setDate(d.getDate() - LOOKBACK_DAYS)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

const safeNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const buildFoodCardRow = (menuRow, userLat, userLng) => {
  const restaurant = menuRow.restaurants

  const lat = safeNumber(restaurant?.lat)
  const lng = safeNumber(restaurant?.lng)
  const hasLocation = Number.isFinite(userLat) && Number.isFinite(userLng)
  const hasRestaurantLocation = lat != null && lng != null

  const distanceKm = hasLocation && hasRestaurantLocation ? haversineDistance(userLat, userLng, lat, lng) : null
  const isClusterEligible = distanceKm != null ? distanceKm <= CLUSTER_RADIUS_KM : false

  return {
    menuItem: {
      id: menuRow.id,
      name: menuRow.name,
      description: menuRow.description,
      price: menuRow.price,
      category: menuRow.category,
      aiTags: menuRow.ai_tags ?? [],
      restaurantId: menuRow.restaurant_id,
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
}

const countByMenuItemId = (rows) => {
  const counter = new Map()
  ;(rows ?? []).forEach((row) => {
    const id = row?.menu_item_id
    if (!id) return
    const weight = Number(row?.quantity)
    counter.set(id, (counter.get(id) || 0) + (Number.isFinite(weight) && weight > 0 ? weight : 1))
  })
  return counter
}

const toRankedIds = (counter, limit) => {
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id)
}

const attachCounts = (items, counter) => {
  const map = counter instanceof Map ? counter : new Map()
  return (items ?? []).map((row) => ({ ...row, count: map.get(row.menuItem?.id) || 0 }))
}

const getPopular = async ({ userLat, userLng, lookbackStartIso }) => {
  const deliveredRows = await orderModel.getDeliveredOrderItemsSince(lookbackStartIso, MAX_ROWS)
  const counter = countByMenuItemId(deliveredRows)
  const topIds = toRankedIds(counter, POPULAR_LIMIT)
  if (topIds.length === 0) return []

  const menuRows = await menuModel.getAvailableByIds(topIds)
  const byId = new Map(menuRows.map((r) => [r.id, r]))

  const ordered = topIds.map((id) => byId.get(id)).filter(Boolean)
  const shaped = ordered.map((row) => buildFoodCardRow(row, userLat, userLng))

  return attachCounts(shaped, counter)
}

const getFrequentlyTogether = async ({ userId, userLat, userLng, lookbackStartIso }) => {
  if (!userId) return []

  const orderIds = await orderModel.getDeliveredOrderIdsByUser(userId, lookbackStartIso, 250)
  if (orderIds.length === 0) return []

  const orderItems = await orderModel.getOrderItemsForOrders(orderIds, MAX_ROWS)
  if (orderItems.length === 0) return []

  const userCounter = countByMenuItemId(orderItems)
  const [topItemId] = toRankedIds(userCounter, 1)
  if (!topItemId) return []

  const targetOrderIdSet = new Set(orderItems.filter((r) => r.menu_item_id === topItemId).map((r) => r.order_id).filter(Boolean))
  if (targetOrderIdSet.size === 0) return []

  const targetItems = orderItems.filter((r) => targetOrderIdSet.has(r.order_id) && r.menu_item_id !== topItemId)
  const togetherCounter = countByMenuItemId(targetItems)
  const topIds = toRankedIds(togetherCounter, TOGETHER_LIMIT)
  if (topIds.length === 0) return []

  const menuRows = await menuModel.getAvailableByIds(topIds)
  const byId = new Map(menuRows.map((r) => [r.id, r]))
  const ordered = topIds.map((id) => byId.get(id)).filter(Boolean)

  const shaped = ordered.map((row) => buildFoodCardRow(row, userLat, userLng))
  return attachCounts(shaped, togetherCounter)
}

const getClusterFriendly = async ({ userLat, userLng }) => {
  const restaurants = await restaurantModel.getAllActive()
  const clusters = getNearbyClusteredRestaurants(restaurants, userLat, userLng)
  if (!clusters.length) return []

  const restaurantIds = [...new Set(clusters.flatMap((c) => c.restaurants.map((r) => r.id)).filter(Boolean))]
  if (!restaurantIds.length) return []

  const menuRows = await menuModel.getAvailableByRestaurantIds(restaurantIds, CLUSTER_LIMIT * 6)
  if (!menuRows.length) return []

  // Prefer better restaurants; break ties by price.
  const sorted = [...menuRows].sort((a, b) => {
    const ar = Number(a.restaurants?.avg_rating || 0)
    const br = Number(b.restaurants?.avg_rating || 0)
    if (br !== ar) return br - ar
    return Number(a.price || 0) - Number(b.price || 0)
  })

  const shaped = sorted.slice(0, CLUSTER_LIMIT).map((row) => buildFoodCardRow(row, userLat, userLng))
  return shaped
}

export const getRecommendations = async ({ userId, userLat, userLng }) => {
  const lookbackStartIso = getLookbackStartIso()

  const popular = await getPopular({ userLat, userLng, lookbackStartIso })

  // Acceptance: new users (no delivered history) see only Popular.
  const userOrderIds = userId ? await orderModel.getDeliveredOrderIdsByUser(userId, lookbackStartIso, 1) : []
  const isReturningUser = userOrderIds.length > 0

  const frequentlyTogether = isReturningUser
    ? await getFrequentlyTogether({ userId, userLat, userLng, lookbackStartIso })
    : []

  const clusterFriendly = isReturningUser
    ? await getClusterFriendly({ userLat, userLng })
    : []

  return { popular, frequentlyTogether, clusterFriendly }
}

export const __testables = {
  buildFoodCardRow,
  countByMenuItemId,
  toRankedIds,
}
