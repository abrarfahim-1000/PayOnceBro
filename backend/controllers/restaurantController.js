import * as restaurantModel from '../models/restaurantModel.js'
import * as menuModel from '../models/menuModel.js'
import * as ratingModel from '../models/ratingModel.js'
import * as orderModel from '../models/orderModel.js'
import * as subOrderModel from '../models/subOrderModel.js'
import * as clusterModel from '../models/clusterModel.js'
import * as deliveryFeeService from '../services/deliveryFeeService.js'
import { estimateDeliveryTime } from '../services/clusteringService.js'
import { findBestRider } from '../services/riderAssignmentService.js'
import * as riderModel from '../models/riderModel.js'
import supabase from '../config/db.js'
import { generateMenuTags, generateVibeSummary } from '../services/geminiService.js'
import { buildMenuTags, inferFallbackTags } from '../services/menuTaggingService.js'
import { startSimulatedOrderFlow } from '../services/orderSimulationService.js'

const VIBE_CACHE_TTL_MS = 60 * 60 * 1000
const vibeCache = new Map()

const getDefaultRestaurantName = (email) => {
  const fallback = 'My Restaurant'
  if (!email) return fallback
  const local = email.split('@')[0]?.trim()
  if (!local) return fallback
  return `${local} Restaurant`
}

/**
 * POST /api/restaurants
 * Creates the restaurant profile for a new restaurant_owner.
 * Returns 409 if the owner already has a restaurant.
 */
export const createRestaurant = async (req, res, next) => {
  try {
    const existing = await restaurantModel.getByOwner(req.user.id)
    if (existing) {
      return res.status(409).json({ message: 'You already have a restaurant registered.' })
    }

    const { name, address, cuisine, phone } = req.body
    if (!name) return res.status(400).json({ message: 'name is required' })

    const restaurant = await restaurantModel.createRestaurant(req.user.id, {
      name,
      address: address ?? null,
      cuisine: cuisine ?? null,
      phone:   phone   ?? null,
    })
    res.status(201).json({ restaurant })
  } catch (err) {
    next(err)
  }
}

// Restaurant role: which status transitions are allowed
const ALLOWED_TRANSITIONS = {
  pending: ['accepted', 'rejected'],
  accepted: ['preparing', 'rejected'],
  preparing: ['pickup'],
  pickup: [],
  rejected: [],
}

const checkAllAcceptance = async (orderId) => {
  const subOrders = await subOrderModel.getByOrder(orderId)
  if (subOrders.length === 0) return null

  const activeSubs = subOrders.filter((s) => s.status !== 'rejected')
  if (activeSubs.length === 0) {
    const updated = await orderModel.updateStatus(orderId, 'cancelled')
    await orderModel.insertStatusHistory(orderId, 'cancelled', null).catch(() => {})
    return updated
  }

  const allAccepted = activeSubs.every((s) => s.status === 'accepted')
  if (!allAccepted) return null

  const updated = await orderModel.updateStatus(orderId, 'accepted')
  await orderModel.insertStatusHistory(orderId, 'accepted', null).catch(() => {})
  try {
    await findBestRider(orderId)
  } catch (assignErr) {
    console.error(`❌ Rider assignment failed for order ${orderId}:`, assignErr?.message || assignErr)
  }
  return updated
}

const checkAllPreparing = async (orderId) => {
  const subOrders = await subOrderModel.getByOrder(orderId)
  if (subOrders.length === 0) return null

  const activeSubs = subOrders.filter((s) => s.status !== 'rejected')
  if (activeSubs.length === 0) return null

  const allPreparing = activeSubs.every((s) => ['preparing', 'pickup'].includes(s.status))
  if (!allPreparing) return null

  const updated = await orderModel.updateStatus(orderId, 'preparing')
  await orderModel.insertStatusHistory(orderId, 'preparing', null).catch(() => {})
  return updated
}

const checkAllPickup = async (orderId) => {
  const subOrders = await subOrderModel.getByOrder(orderId)
  if (subOrders.length === 0) return null

  const activeSubs = subOrders.filter((s) => s.status !== 'rejected')
  if (activeSubs.length === 0) return null

  const allPickup = activeSubs.every((s) => s.status === 'pickup')
  if (!allPickup) return null

  const order = await orderModel.getById(orderId)
  if (order && !order.rider_id) {
    try {
      await findBestRider(orderId)
    } catch (assignErr) {
      console.error(`❌ Rider assignment failed for order ${orderId}:`, assignErr?.message || assignErr)
    }
  }

  const updated = await orderModel.updateStatus(orderId, 'pickup')
  await orderModel.insertStatusHistory(orderId, 'pickup', null).catch(() => {})
  return updated
}

const handleRestaurantRejection = async (orderId, restaurantId) => {
  await orderModel.deleteItemsByRestaurant(orderId, restaurantId)
  const remainingItems = await orderModel.getItemsByOrder(orderId)
  const remainingRestaurantIds = [...new Set(remainingItems.map((i) => i.restaurant_id).filter(Boolean))]

  if (remainingRestaurantIds.length === 0) {
    await orderModel.updateTotals(orderId, { totalPrice: 0, deliveryFee: 0 })
    const updated = await orderModel.updateStatus(orderId, 'cancelled')
    await orderModel.insertStatusHistory(orderId, 'cancelled', null).catch(() => {})
    return updated
  }

  const restaurants = await restaurantModel.getByIds(remainingRestaurantIds)
  const order = await orderModel.getById(orderId)
  const subtotal = remainingItems.reduce(
    (sum, item) => sum + Number(item.price_at_order || 0) * Number(item.quantity || 0),
    0
  )
  const feeResult = deliveryFeeService.calculate(
    restaurants,
    Number(order.user_lat ?? 0),
    Number(order.user_lng ?? 0),
    restaurants.length > 1
  )
  const eta = estimateDeliveryTime(restaurants, Number(order.user_lat ?? 0), Number(order.user_lng ?? 0))

  await orderModel.updateTotals(orderId, {
    totalPrice: Number(subtotal.toFixed(2)),
    deliveryFee: feeResult.fee,
    estimatedTime: eta.estimatedMinutes,
  })

  if (order.cluster_id) {
    await clusterModel
      .updateRestaurantIds(order.cluster_id, remainingRestaurantIds)
      .catch(() => {})
  }

  return order
}

/**
 * GET /api/restaurants/orders
 * Returns orders grouped into pending | preparing | pickup | completed.
 * Each order includes:
 *   myItems[]         — items from THIS restaurant (for the kitchen)
 *   isClusteredOrder  — boolean
 *   cluster           — { id, restaurant_ids, restaurantCount } | null
 *   restaurantPrepTime — minutes, drives the frontend countdown timer
 */
export const getOrders = async (req, res, next) => {
  try {
    const restaurant = await restaurantModel.getByOwner(req.user.id)
    if (!restaurant) {
      return res.status(404).json({ message: 'No restaurant found for this account' })
    }

    const subOrders = await subOrderModel.getByRestaurant(restaurant.id)
    if (subOrders.length === 0) {
      return res.json({ pending: [], preparing: [], pickup: [], completed: [] })
    }

    const orderIds = [...new Set(subOrders.map((s) => s.order_id))]
    const myItems = await restaurantModel.getOrderItemsByRestaurant(restaurant.id)

    const [activeOrders, completedOrders] = await Promise.all([
      restaurantModel.getActiveOrdersByIds(orderIds),
      restaurantModel.getCompletedOrdersByIds(orderIds),
    ])

    const allOrders = [...activeOrders, ...completedOrders]
    if (allOrders.length === 0) {
      return res.json({ pending: [], preparing: [], pickup: [], completed: [] })
    }

    // Fetch cluster details for any clustered orders
    const clusterIds = [...new Set(allOrders.filter((o) => o.cluster_id).map((o) => o.cluster_id))]
    const clustersMap = {}
    if (clusterIds.length > 0) {
      const clusters = await restaurantModel.getClustersByIds(clusterIds)
      clusters.forEach((c) => {
        clustersMap[c.id] = {
          ...c,
          restaurantCount: Array.isArray(c.restaurant_ids) ? c.restaurant_ids.length : 0,
        }
      })
    }

    const itemsByOrder = myItems.reduce((acc, item) => {
      if (!acc[item.order_id]) acc[item.order_id] = []
      acc[item.order_id].push(item)
      return acc
    }, {})

    const subStatusByOrder = subOrders.reduce((acc, sub) => {
      acc[sub.order_id] = sub.status === 'pickup' ? 'completed' : sub.status
      return acc
    }, {})
    const riderIds = [...new Set(allOrders.map((o) => o.rider_id).filter(Boolean))]
    let riderMap = {}

    if (riderIds.length > 0) {
      const { data: riders, error: riderErr } = await supabase
        .from('riders')
        .select('id, user_id, avg_rating')
        .in('id', riderIds)

      if (riderErr) throw riderErr

      const userIds = [...new Set((riders ?? []).map((r) => r.user_id).filter(Boolean))]
      let profileMap = {}

      if (userIds.length > 0) {
        const { data: profiles, error: profileErr } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', userIds)

        if (profileErr) throw profileErr
        profileMap = (profiles ?? []).reduce((acc, p) => {
          acc[p.id] = p
          return acc
        }, {})
      }

      riderMap = (riders ?? []).reduce((acc, r) => {
        const profile = profileMap[r.user_id] || {}
        acc[r.id] = {
          id: r.id,
          fullName: profile.full_name || profile.username || 'Rider',
          avgRating: r.avg_rating ?? 0,
        }
        return acc
      }, {})
    }

    const enriched = allOrders.map((order) => ({
      ...order,
      restaurant_status: subStatusByOrder[order.id] || 'pending',
      myItems: itemsByOrder[order.id] ?? [],
      isClusteredOrder: !!order.cluster_id,
      cluster: order.cluster_id ? (clustersMap[order.cluster_id] ?? null) : null,
      rider: order.rider_id ? riderMap[order.rider_id] ?? null : null,
      // Used by the frontend PrepTimer — starts counting down on 'accepted'
      restaurantPrepTime: restaurant.avg_prep_time ?? 30,
    }))

    res.json({
      pending: enriched.filter((o) => o.restaurant_status === 'pending'),
      preparing: enriched.filter((o) => ['accepted', 'preparing'].includes(o.restaurant_status)),
      completed: enriched.filter((o) => o.restaurant_status === 'completed' || o.status === 'delivered'),
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/restaurants/orders/:orderId/status
 * Body: { status: 'accepted' | 'preparing' | 'cancelled' }
 */
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params
    const { status } = req.body
    if (!status) return res.status(400).json({ message: 'status is required' })

    const restaurant = await restaurantModel.getByOwner(req.user.id)
    if (!restaurant) return res.status(404).json({ message: 'No restaurant found for this account' })

    // Verify this order belongs to the restaurant
    const myItems = await restaurantModel.getOrderItemsByRestaurant(restaurant.id)
    if (!myItems.some((i) => i.order_id === orderId)) {
      return res.status(403).json({ message: 'This order does not belong to your restaurant' })
    }

    const order = await restaurantModel.getOrderById(orderId)
    if (!order) return res.status(404).json({ message: 'Order not found' })

    const subOrder = await subOrderModel.getByOrderAndRestaurant(orderId, restaurant.id)
    if (!subOrder) {
      return res.status(404).json({ message: 'Sub-order not found for this restaurant' })
    }
    const allowed = ALLOWED_TRANSITIONS[subOrder.status]
    if (!allowed || !allowed.includes(status)) {
      return res.status(400).json({
        message: `Cannot transition '${subOrder.status}' → '${status}'. Allowed: ${(allowed ?? []).join(', ') || 'none'}`,
      })
    }

    const updatedSub = await subOrderModel.updateStatus(subOrder.id, status)

    if (status === 'accepted') {
      await checkAllAcceptance(orderId)
    }

    if (status === 'preparing') {
      await checkAllPreparing(orderId)
    }

    if (status === 'rejected') {
      await handleRestaurantRejection(orderId, restaurant.id)
      await checkAllAcceptance(orderId)
    }

    if (status === 'pickup') {
      await checkAllPickup(orderId)
    }

    res.json({ order: order, subOrder: updatedSub })
  } catch (err) {
    next(err)
  }
}

// ─── Menu Management ─────────────────────────────────────────────────────────

/**
 * GET /api/restaurants/menu
 * Returns all menu items + key restaurant settings for the current owner.
 */
export const getMenu = async (req, res, next) => {
  try {
    const restaurant = await restaurantModel.getByOwner(req.user.id)
    if (!restaurant) return res.status(404).json({ message: 'No restaurant found for this account' })
    const items = await restaurantModel.getMenuItems(restaurant.id)
    res.json({
      items,
      restaurant: {
        avg_prep_time: restaurant.avg_prep_time ?? null,
        max_orders_per_hour: restaurant.max_capacity_per_hour ?? null,
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/restaurants/menu
 * Body: { name, category?, price, description? }
 */
export const addMenuItem = async (req, res, next) => {
  try {
    const restaurant = await restaurantModel.getByOwner(req.user.id)
    if (!restaurant) return res.status(404).json({ message: 'No restaurant found for this account' })

    const { name, category, price, description, image_url } = req.body
    if (!name || price == null) {
      return res.status(400).json({ message: 'name and price are required' })
    }
    if (Number(price) < 0) {
      return res.status(400).json({ message: 'price must be 0 or greater' })
    }

    const item = await restaurantModel.createMenuItem(restaurant.id, {
      name,
      category: category ?? null,
      price: Number(price),
      description: description ?? null,
      image_url: image_url ?? null,
      is_available: true,
    })

    let taggedItem = item
    const fallbackTags = inferFallbackTags(item.name, item.description)
    try {
      if (fallbackTags.length > 0) {
        taggedItem = await menuModel.updateTags(item.id, fallbackTags)
      }
      const tags = await buildMenuTags(item.name, item.description)
      taggedItem = await menuModel.updateTags(item.id, tags)
    } catch {
      // Menu write should still succeed even if tag update fails.
    }

    res.status(201).json({ item: taggedItem })

    ;(async () => {
      try {
        const aiTags = await generateMenuTags(item.name, item.description)
        if (Array.isArray(aiTags) && aiTags.length > 0) {
          const merged = [...new Set([...aiTags, ...fallbackTags])]
          await menuModel.updateTags(item.id, merged)
        }
      } catch {
        // Background tagging should not impact the response.
      }
    })()
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/restaurants/menu/:itemId
 * Body: any combination of { name, category, price, description, is_available }
 */
export const editMenuItem = async (req, res, next) => {
  try {
    const restaurant = await restaurantModel.getByOwner(req.user.id)
    if (!restaurant) return res.status(404).json({ message: 'No restaurant found for this account' })

    const { itemId } = req.params
    const ALLOWED = ['name', 'category', 'price', 'description', 'is_available', 'image_url']
    const updates = {}
    ALLOWED.forEach((k) => {
      if (req.body[k] !== undefined) updates[k] = req.body[k]
    })
    if (updates.price !== undefined) updates.price = Number(updates.price)

    const item = await restaurantModel.updateMenuItem(restaurant.id, itemId, updates)

    const shouldRegenerateTags = updates.name !== undefined || updates.description !== undefined
    if (!shouldRegenerateTags) {
      return res.json({ item })
    }

    let taggedItem = item
    const fallbackTags = inferFallbackTags(item.name, item.description)
    try {
      const tags = await buildMenuTags(item.name, item.description)
      taggedItem = await menuModel.updateTags(item.id, tags)
    } catch {
      // Keep successful menu updates even if tag update fails.
    }

    res.json({ item: taggedItem })

    ;(async () => {
      try {
        const aiTags = await generateMenuTags(item.name, item.description)
        if (Array.isArray(aiTags) && aiTags.length > 0) {
          const merged = [...new Set([...aiTags, ...fallbackTags])]
          await menuModel.updateTags(item.id, merged)
        }
      } catch {
        // Background tagging should not impact the response.
      }
    })()
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/restaurants/menu/:itemId
 */
export const removeMenuItem = async (req, res, next) => {
  try {
    const restaurant = await restaurantModel.getByOwner(req.user.id)
    if (!restaurant) return res.status(404).json({ message: 'No restaurant found for this account' })

    await restaurantModel.deleteMenuItem(restaurant.id, req.params.itemId)
    res.json({ message: 'Item deleted' })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/restaurants/profile
 * Returns the public profile fields for the current owner's restaurant.
 */
export const getProfile = async (req, res, next) => {
  try {
    let restaurant = await restaurantModel.getByOwner(req.user.id)
    if (!restaurant) {
      restaurant = await restaurantModel.createRestaurant(req.user.id, {
        name: getDefaultRestaurantName(req.user?.email),
      })
    }
    res.json({
      profile: {
        id: restaurant.id,
        owner_id: restaurant.owner_id,
        name: restaurant.name ?? '',
        address: restaurant.address ?? '',
        lat: restaurant.lat,
        lng: restaurant.lng,
        avg_prep_time: restaurant.avg_prep_time,
        max_capacity_per_hour: restaurant.max_capacity_per_hour,
        is_active: restaurant.is_active,
        avg_rating: restaurant.avg_rating,
        created_at: restaurant.created_at,
        cuisine: restaurant.cuisine ?? '',
        prep_time_minutes: restaurant.prep_time_minutes,
        phone: restaurant.phone ?? '',
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/restaurants/profile
 * Body: { name?, address?, cuisine?, phone? }
 */
export const updateProfile = async (req, res, next) => {
  try {
    let restaurant = await restaurantModel.getByOwner(req.user.id)

    const ALLOWED = [
      'name',
      'address',
      'lat',
      'lng',
      'avg_prep_time',
      'max_capacity_per_hour',
      'is_active',
      'cuisine',
      'prep_time_minutes',
      'phone',
    ]
    const fields = {}
    ALLOWED.forEach((k) => {
      if (req.body[k] !== undefined) fields[k] = req.body[k]
    })

    if (fields.lat != null) fields.lat = Number(fields.lat)
    if (fields.lng != null) fields.lng = Number(fields.lng)
    if (fields.avg_prep_time != null) fields.avg_prep_time = Number(fields.avg_prep_time)
    if (fields.max_capacity_per_hour != null) fields.max_capacity_per_hour = Number(fields.max_capacity_per_hour)
    if (fields.prep_time_minutes != null) fields.prep_time_minutes = Number(fields.prep_time_minutes)
    if (fields.is_active != null) {
      if (typeof fields.is_active === 'string') {
        fields.is_active = fields.is_active.toLowerCase() === 'true'
      } else {
        fields.is_active = !!fields.is_active
      }
    }

    if (fields.lat != null && Number.isNaN(fields.lat)) return res.status(400).json({ message: 'lat must be a valid number' })
    if (fields.lng != null && Number.isNaN(fields.lng)) return res.status(400).json({ message: 'lng must be a valid number' })
    if (fields.avg_prep_time != null && Number.isNaN(fields.avg_prep_time)) return res.status(400).json({ message: 'avg_prep_time must be a valid number' })
    if (fields.max_capacity_per_hour != null && Number.isNaN(fields.max_capacity_per_hour)) return res.status(400).json({ message: 'max_capacity_per_hour must be a valid number' })
    if (fields.prep_time_minutes != null && Number.isNaN(fields.prep_time_minutes)) return res.status(400).json({ message: 'prep_time_minutes must be a valid number' })

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided' })
    }

    if (!restaurant) {
      const seed = {
        name: fields.name || getDefaultRestaurantName(req.user?.email),
        address: fields.address ?? null,
        cuisine: fields.cuisine ?? null,
        phone: fields.phone ?? null,
        lat: fields.lat ?? null,
        lng: fields.lng ?? null,
        avg_prep_time: fields.avg_prep_time ?? null,
        max_capacity_per_hour: fields.max_capacity_per_hour ?? null,
        prep_time_minutes: fields.prep_time_minutes ?? null,
        is_active: fields.is_active ?? true,
      }
      restaurant = await restaurantModel.createRestaurant(req.user.id, seed)
    }

    const updated = await restaurantModel.updateRestaurantProfile(restaurant.id, fields)
    res.json({
      profile: {
        id: updated.id,
        owner_id: updated.owner_id,
        name: updated.name ?? '',
        address: updated.address ?? '',
        lat: updated.lat,
        lng: updated.lng,
        avg_prep_time: updated.avg_prep_time,
        max_capacity_per_hour: updated.max_capacity_per_hour,
        is_active: updated.is_active,
        avg_rating: updated.avg_rating,
        created_at: updated.created_at,
        cuisine: updated.cuisine ?? '',
        prep_time_minutes: updated.prep_time_minutes,
        phone: updated.phone ?? '',
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/restaurants/settings
 * Body: { avg_prep_time?, max_orders_per_hour? }
 */
export const updateSettings = async (req, res, next) => {
  try {
    const restaurant = await restaurantModel.getByOwner(req.user.id)
    if (!restaurant) return res.status(404).json({ message: 'No restaurant found for this account' })

    const settings = {}
    if (req.body.avg_prep_time != null) settings.avg_prep_time = Number(req.body.avg_prep_time)
    if (req.body.max_orders_per_hour != null) settings.max_capacity_per_hour = Number(req.body.max_orders_per_hour)

    if (Object.keys(settings).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided' })
    }

    const updated = await restaurantModel.updateRestaurantSettings(restaurant.id, settings)
    res.json({ restaurant: updated })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/restaurants/:id/vibe
 * Public endpoint for a short, cached summary of recent reviews.
 */
export const getVibeSummary = async (req, res, next) => {
  try {
    const { id: restaurantId } = req.params
    if (!restaurantId) {
      return res.status(400).json({ message: 'Restaurant id is required' })
    }

    const cached = vibeCache.get(restaurantId)
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ summary: cached.summary })
    }

    const reviews = await ratingModel.getRecentRestaurantReviews(restaurantId, 20)
    if (reviews.length < 3) {
      vibeCache.set(restaurantId, {
        summary: null,
        expiresAt: Date.now() + VIBE_CACHE_TTL_MS,
      })
      return res.json({ summary: null })
    }

    const summary = await generateVibeSummary(reviews)
    vibeCache.set(restaurantId, {
      summary: summary || null,
      expiresAt: Date.now() + VIBE_CACHE_TTL_MS,
    })

    res.json({ summary: summary || null })
  } catch (err) {
    next(err)
  }
}
