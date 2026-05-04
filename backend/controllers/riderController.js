// backend/controllers/riderController.js
// Request handlers — validate input, call services/models, send responses

import * as riderModel from '../models/riderModel.js'
import * as orderModel from '../models/orderModel.js'
import { optimizeRoute } from '../services/routeService.js'
import * as clusterModel from '../models/clusterModel.js'
import * as restaurantModel from '../models/restaurantModel.js'
import supabase from '../config/db.js'

/**
 * updateLocation — rider sends their current GPS coordinates every 30 seconds.
 * This updates the rider's location in the database.
 *
 * Request:  PUT /api/rider/location
 * Auth:     JWT (rider)
 * Body:     { lat, lng }
 * Response: { success: true, location: { id, current_lat, current_lng } }
 */
export const updateLocation = async (req, res, next) => {
  try {
    const { lat, lng } = req.body
    const userId = req.user.id

    // Validate inputs
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ message: 'lat and lng must be numbers' })
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ message: 'Invalid coordinates' })
    }

    // Update in database
    const location = await riderModel.updateLocationByUserId(userId, lat, lng)

    if (!location) {
      return res.status(404).json({ message: 'Rider not found. Please load your profile first.' })
    }

    res.json({
      success: true,
      location,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * getLocation — fetch a rider's current location.
 *
 * Request:  GET /api/rider/:id/location
 * Auth:     JWT
 * Response: { id, current_lat, current_lng }
 */
export const getLocation = async (req, res, next) => {
  try {
    const { id } = req.params

    const location = await riderModel.getLocation(id)

    if (!location) {
      return res.status(404).json({ message: 'Rider not found' })
    }

    res.json(location)
  } catch (error) {
    next(error)
  }
}

/**
 * getProfile — fetch rider's full profile (used on dashboard).
 *
 * Request:  GET /api/rider/profile/me
 * Auth:     JWT (rider)
 * Response: { id, user_id, current_lat, current_lng, is_available, avg_rating, total_deliveries }
 *           OR default profile if rider doesn't exist
 */
export const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id

    let rider = await riderModel.getByUserId(userId)

    // If rider profile doesn't exist, return a default profile
    // The rider record will be created when the user registers OR when their first order is assigned
    if (!rider) {
      console.log(`No rider profile found for user ${userId}. Returning default profile.`)
      return res.json({
        id: null,
        user_id: userId,
        current_lat: 0,
        current_lng: 0,
        is_available: true,
        avg_rating: 0,
        total_deliveries: 0,
      })
    }

    res.json(rider)
  } catch (error) {
    next(error)
  }
}

/**
 * getAssignments — fetch active assignments for logged-in rider.
 *
 * Request:  GET /api/rider/assignments
 * Auth:     JWT (rider)
 */
export const getAssignments = async (req, res, next) => {
  try {
    const rider = await riderModel.getByUserId(req.user.id)
    if (!rider) return res.json({ assignments: [] })

    const activeStatuses = ['accepted', 'preparing', 'pickup', 'on_the_way']
    const orders = await orderModel.getByRider(rider.id, activeStatuses)
    if (orders.length === 0) return res.json({ assignments: [] })

    const orderIds = orders.map((o) => o.id)
    const items = await orderModel.getItemsForOrders(orderIds)

    const itemsByOrder = items.reduce((acc, item) => {
      if (!acc[item.order_id]) acc[item.order_id] = []
      acc[item.order_id].push(item)
      return acc
    }, {})

    const assignments = orders.map((order) => {
      const orderItems = itemsByOrder[order.id] ?? []
      const restaurantsById = {}
      orderItems.forEach((item) => {
        if (item.restaurant_id && item.restaurants && !restaurantsById[item.restaurant_id]) {
          restaurantsById[item.restaurant_id] = item.restaurants
        }
      })

      return {
        ...order,
        restaurants: Object.values(restaurantsById),
        itemCount: orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0),
      }
    })

    res.json({ assignments })
  } catch (error) {
    next(error)
  }
}

/**
 * getEarnings — summary stats for rider dashboard card.
 *
 * Request:  GET /api/rider/earnings
 * Auth:     JWT (rider)
 */
export const getEarnings = async (req, res, next) => {
  try {
    const rider = await riderModel.getByUserId(req.user.id)
    if (!rider) {
      return res.json({
        totalEarnings: 0,
        totalDeliveries: 0,
        todayEarnings: 0,
        todayDeliveries: 0,
        weeklyEarnings: 0,
        weeklyDeliveries: 0,
        monthlyEarnings: 0,
        monthlyDeliveries: 0,
      })
    }

    const deliveredOrders = await orderModel.getByRider(rider.id, ['delivered'])
    const now = new Date()
    const todayY = now.getFullYear()
    const todayM = now.getMonth()
    const todayD = now.getDate()

    // Calculate start of this week (Monday). If today is Sunday (0), go back 6 days.
    const startOfWeek = new Date(now)
    const day = now.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    startOfWeek.setDate(now.getDate() + diffToMonday)
    startOfWeek.setHours(0, 0, 0, 0)

    // Calculate start of this month
    const startOfMonth = new Date(todayY, todayM, 1)

    const totals = deliveredOrders.reduce(
      (acc, order) => {
        const deliveryFee = Number(order.delivery_fee) || 0
        acc.totalEarnings += deliveryFee
        acc.totalDeliveries += 1

        const deliveredAt = order.delivered_at ? new Date(order.delivered_at) : null
        
        // Today
        if (
          deliveredAt &&
          deliveredAt.getFullYear() === todayY &&
          deliveredAt.getMonth() === todayM &&
          deliveredAt.getDate() === todayD
        ) {
          acc.todayEarnings += deliveryFee
          acc.todayDeliveries += 1
        }

        // This week (Monday to now)
        if (deliveredAt && deliveredAt >= startOfWeek && deliveredAt <= now) {
          acc.weeklyEarnings += deliveryFee
          acc.weeklyDeliveries += 1
        }

        // This month
        if (
          deliveredAt &&
          deliveredAt.getFullYear() === todayY &&
          deliveredAt.getMonth() === todayM
        ) {
          acc.monthlyEarnings += deliveryFee
          acc.monthlyDeliveries += 1
        }

        return acc
      },
      {
        totalEarnings: 0,
        totalDeliveries: 0,
        todayEarnings: 0,
        todayDeliveries: 0,
        weeklyEarnings: 0,
        weeklyDeliveries: 0,
        monthlyEarnings: 0,
        monthlyDeliveries: 0,
      }
    )

    res.json({
      totalEarnings: Number(totals.totalEarnings.toFixed(2)),
      totalDeliveries: totals.totalDeliveries,
      todayEarnings: Number(totals.todayEarnings.toFixed(2)),
      todayDeliveries: totals.todayDeliveries,
      weeklyEarnings: Number(totals.weeklyEarnings.toFixed(2)),
      weeklyDeliveries: totals.weeklyDeliveries,
      monthlyEarnings: Number(totals.monthlyEarnings.toFixed(2)),
      monthlyDeliveries: totals.monthlyDeliveries,
      rating: rider.avg_rating || 0,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * getRoute — Optimized pickup route for a cluster assignment
 *
 * Request:  GET /api/rider/route/:clusterId
 * Auth:     JWT (rider)
 * Params:   clusterId
 * Response: { orderedStops, mapsUrl, totalDistance }
 */
export const getRoute = async (req, res, next) => {
  try {
    const { clusterId } = req.params
    const riderId = req.user.id

    // Get rider's current location
    const rider = await riderModel.getByUserId(riderId)
    if (!rider) {
      return res.status(404).json({ message: 'Rider not found' })
    }

    const riderLocation = {
      lat: rider.current_lat,
      lng: rider.current_lng,
    }

    // Get cluster details
    const { data: cluster, error: clusterError } = await supabase
      .from('clusters')
      .select('restaurant_ids, id')
      .eq('id', clusterId)
      .single()

    if (clusterError && clusterError.code !== 'PGRST116') {
      throw clusterError
    }

    if (!cluster) {
      return res.status(404).json({ message: 'Cluster not found' })
    }

    // Get restaurants in the cluster
    const restaurantIds = cluster.restaurant_ids || []
    const restaurants = await restaurantModel.getByIds(restaurantIds)

    // Get customer order and address (must belong to the logged-in rider)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_lat, user_lng, cluster_id, rider_id, status')
      .eq('cluster_id', clusterId)
      .eq('rider_id', rider.id)
      .in('status', ['accepted', 'preparing', 'pickup', 'on_the_way'])
      .limit(1)
      .single()

    if (orderError && orderError.code !== 'PGRST116') {
      throw orderError
    }

    if (!order) {
      return res.status(403).json({ message: 'You do not have an active order assigned to this cluster' })
    }

    // Build stops array: restaurants + customer
    const stops = [
      ...restaurants.map((r) => ({
        id: r.id,
        name: r.name,
        type: 'restaurant',
        lat: r.lat,
        lng: r.lng,
      })),
      {
        id: 'customer',
        name: 'Customer Delivery Location',
        type: 'customer',
        lat: order.user_lat,
        lng: order.user_lng,
      },
    ]

    // Optimize route
    const routeData = optimizeRoute(stops, riderLocation)

    res.json(routeData)
  } catch (error) {
    next(error)
  }
}

/**
 * getOrderRoute — Optimized pickup route for a single (non-cluster) assignment
 *
 * Request:  GET /api/rider/route/order/:orderId
 * Auth:     JWT (rider)
 * Params:   orderId
 * Response: { orderedStops, mapsUrl, totalDistance }
 */
export const getOrderRoute = async (req, res, next) => {
  try {
    const { orderId } = req.params
    const riderId = req.user.id

    // Get rider's current location
    const rider = await riderModel.getByUserId(riderId)
    if (!rider) {
      return res.status(404).json({ message: 'Rider not found' })
    }

    const riderLocation = {
      lat: rider.current_lat,
      lng: rider.current_lng,
    }

    // Get the order assigned to this rider
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_lat, user_lng, rider_id, status')
      .eq('id', orderId)
      .eq('rider_id', rider.id)
      .in('status', ['accepted', 'preparing', 'pickup', 'on_the_way'])
      .single()

    if (orderError && orderError.code !== 'PGRST116') {
      throw orderError
    }

    if (!order) {
      return res.status(403).json({ message: 'You do not have an active order assigned to this id' })
    }

    // Get restaurants from order items
    const { data: itemRows, error: itemsErr } = await supabase
      .from('order_items')
      .select('restaurant_id, restaurants ( id, name, lat, lng )')
      .eq('order_id', order.id)

    if (itemsErr) throw itemsErr

    const restaurantMap = new Map()
    ;(itemRows ?? []).forEach((row) => {
      const r = row.restaurants
      if (!r || !r.id) return
      if (!restaurantMap.has(r.id)) {
        restaurantMap.set(r.id, {
          id: r.id,
          name: r.name,
          type: 'restaurant',
          lat: r.lat,
          lng: r.lng,
        })
      }
    })

    const restaurants = [...restaurantMap.values()]
    if (restaurants.length === 0) {
      return res.status(400).json({ message: 'No restaurants found for this order' })
    }

    // Build stops array: restaurants + customer
    const stops = [
      ...restaurants,
      {
        id: 'customer',
        name: 'Customer Delivery Location',
        type: 'customer',
        lat: order.user_lat,
        lng: order.user_lng,
      },
    ]

    const routeData = optimizeRoute(stops, riderLocation)
    res.json(routeData)
  } catch (error) {
    next(error)
  }
}

/**
 * setLocationForTesting — DEVELOPMENT ONLY
 * Manually set a rider's location for testing without geolocation.
 * 
 * Request:  POST /api/rider/testlocation
 * Auth:     JWT (rider)
 * Body:     { lat, lng }
 * Response: { success, location }
 */
export const setLocationForTesting = async (req, res, next) => {
  try {
    const { lat, lng } = req.body
    const userId = req.user.id

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ message: 'lat and lng must be numbers' })
    }

    const location = await riderModel.updateLocationByUserId(userId, lat, lng)
    
    if (!location) {
      return res.status(404).json({ message: 'Rider not found' })
    }

    console.log(`✅ [TEST] Rider ${userId} location set to lat=${lat}, lng=${lng}`)
    res.json({ success: true, location })
  } catch (error) {
    next(error)
  }
}
