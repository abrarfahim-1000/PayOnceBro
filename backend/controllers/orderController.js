import * as orderModel from '../models/orderModel.js'
import * as riderModel from '../models/riderModel.js'
import * as restaurantModel from '../models/restaurantModel.js'
import * as menuModel from '../models/menuModel.js'
import * as clusterModel from '../models/clusterModel.js'
import * as subOrderModel from '../models/subOrderModel.js'
import * as deliveryFeeService from '../services/deliveryFeeService.js'
import { estimateDeliveryTime } from '../services/clusteringService.js'
import { findBestRider } from '../services/riderAssignmentService.js'
import supabase from '../config/db.js'
import { startSimulatedOrderFlow } from '../services/orderSimulationService.js'

const RESTAURANT_ALLOWED = {
  pending: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['pickup', 'cancelled'],
}

const RIDER_ALLOWED = {
  preparing: ['pickup'],
  pickup: ['on_the_way'],
  on_the_way: ['delivered'],
}

export const placeOrder = async (req, res, next) => {
  try {
    const { items = [], restaurantIds = [], userLat, userLng, isCluster = false } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items must be a non-empty array' })
    }

    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) {
      return res.status(400).json({ message: 'restaurantIds must be a non-empty array' })
    }

    if (userLat == null || userLng == null) {
      return res.status(400).json({ message: 'userLat and userLng are required' })
    }

    const menuItemIds = [...new Set(items.map((i) => i.menuItemId).filter(Boolean))]
    const menuItems = await menuModel.getByIds(menuItemIds)
    const menuMap = new Map(menuItems.map((m) => [m.id, m]))

    for (const cartItem of items) {
      const dbItem = menuMap.get(cartItem.menuItemId)
      if (!dbItem) {
        return res.status(400).json({ message: `Menu item not found: ${cartItem.menuItemId}` })
      }
      if (!dbItem.is_available) {
        return res.status(400).json({ message: `Menu item unavailable: ${dbItem.name}` })
      }
      if (dbItem.restaurant_id !== cartItem.restaurantId) {
        return res.status(400).json({ message: `Menu item ${dbItem.name} does not belong to restaurant ${cartItem.restaurantId}` })
      }
      if (!Number.isInteger(cartItem.quantity) || cartItem.quantity <= 0) {
        return res.status(400).json({ message: `Invalid quantity for item ${dbItem.name}` })
      }
    }

    const restaurants = await restaurantModel.getByIds(restaurantIds)
    if (restaurants.length !== restaurantIds.length) {
      return res.status(400).json({ message: 'Some restaurants were not found or inactive' })
    }

    const subtotal = items.reduce((sum, i) => {
      const dbItem = menuMap.get(i.menuItemId)
      return sum + dbItem.price * i.quantity
    }, 0)

    const feeResult = deliveryFeeService.calculate(
      restaurants,
      Number(userLat),
      Number(userLng),
      Boolean(isCluster)
    )
    const eta = estimateDeliveryTime(restaurants, Number(userLat), Number(userLng))

    let clusterId = null
    if (isCluster) {
      const cluster = await clusterModel.create(restaurantIds)
      clusterId = cluster.id
    }

    const order = await orderModel.create({
      userId: req.user.id,
      clusterId,
      status: 'pending',
      totalPrice: Number((subtotal).toFixed(2)),
      deliveryFee: feeResult.fee,
      estimatedTime: eta.estimatedMinutes,
      userLat: Number(userLat),
      userLng: Number(userLng),
    })

    const itemPayload = items.map((i) => ({
      menuItemId: i.menuItemId,
      restaurantId: i.restaurantId,
      quantity: i.quantity,
      priceAtOrder: menuMap.get(i.menuItemId).price,
    }))
    await orderModel.createItems(order.id, itemPayload)
    await subOrderModel.createForOrder(order.id, restaurantIds)
    let historyWriteFailed = false
    try {
      await orderModel.insertStatusHistory(order.id, 'pending', req.user.id)
    } catch (historyErr) {
      console.warn('Order status history insert failed on placeOrder:', historyErr?.message || historyErr)
      historyWriteFailed = true
    }

    res.status(201).json({
      orderId: order.id,
      clusterId,
      fee: feeResult.fee,
      estimatedMinutes: eta.estimatedMinutes,
      historyWriteFailed,
    })
  } catch (err) {
    next(err)
  }
}

export const getById = async (req, res, next) => {
  try {
    const { id } = req.params
    const data = await orderModel.getWithItems(id)
    if (!data) return res.status(404).json({ message: 'Order not found' })

    const { order, items } = data
    const role = req.user.role

    if (role === 'user' && order.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' })
    }

    if (role === 'rider') {
      const rider = await riderModel.getByUserId(req.user.id)
      if (!rider || order.rider_id !== rider.id) {
        return res.status(403).json({ message: 'Access denied' })
      }
    }

    if (role === 'restaurant_owner') {
      const ownsOrder = await orderModel.isOwnedByRestaurantOwner(id, req.user.id)
      if (!ownsOrder) {
        return res.status(403).json({ message: 'Access denied' })
      }
    }

    const cluster = order.cluster_id ? await clusterModel.getById(order.cluster_id) : null
    res.json({ order, items, cluster })
  } catch (err) {
    next(err)
  }
}

export const getByUser = async (req, res, next) => {
  try {
    const orders = await orderModel.getByUser(req.user.id)
    const riderIds = [...new Set(orders.map((o) => o.rider_id).filter(Boolean))]
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

    const enriched = orders.map((order) => ({
      ...order,
      rider: order.rider_id ? riderMap[order.rider_id] ?? null : null,
    }))

    res.json(enriched)
  } catch (err) {
    next(err)
  }
}

export const updateStatus = async (req, res, next) => {
  try {
    const { id: orderId } = req.params
    const { status } = req.body

    if (!status) {
      return res.status(400).json({ message: 'status is required' })
    }

    const order = await orderModel.getById(orderId)
    if (!order) {
      return res.status(404).json({ message: 'Order not found' })
    }

    const role = req.user.role
    let allowed = []

    if (role === 'restaurant_owner') {
      const ownsOrder = await orderModel.isOwnedByRestaurantOwner(orderId, req.user.id)
      if (!ownsOrder) {
        return res.status(403).json({ message: 'This order does not belong to your restaurant' })
      }
      allowed = RESTAURANT_ALLOWED[order.status] ?? []
    } else if (role === 'rider') {
      const rider = await riderModel.getByUserId(req.user.id)
      if (!rider) {
        return res.status(404).json({ message: 'Rider profile not found' })
      }
      if (!order.rider_id || order.rider_id !== rider.id) {
        return res.status(403).json({ message: 'Order is not assigned to this rider' })
      }
      allowed = RIDER_ALLOWED[order.status] ?? []
    } else if (role === 'admin') {
      if (status !== 'cancelled') {
        return res.status(400).json({ message: 'Admin can only cancel orders' })
      }
      allowed = ['cancelled']
    } else {
      return res.status(403).json({ message: 'Access denied' })
    }

    if (!allowed.includes(status)) {
      return res.status(400).json({
        message: `Cannot transition '${order.status}' -> '${status}'. Allowed: ${allowed.join(', ') || 'none'}`,
      })
    }

    const updated = await orderModel.updateStatus(orderId, status)
    let historyWriteFailed = false
    try {
      await orderModel.insertStatusHistory(orderId, status, req.user.id)
    } catch (historyErr) {
      console.warn('Order status history insert failed on updateStatus:', historyErr?.message || historyErr)
      historyWriteFailed = true
    }

    if (role === 'restaurant_owner' && status === 'accepted') {
      try {
        const assignmentResult = await findBestRider(orderId)
        if (assignmentResult) {
          console.log(`✅ Rider assigned to order ${orderId}:`, assignmentResult)
        } else {
          console.warn(`⚠️ No rider assigned to order ${orderId} (no available riders or location data missing)`)
        }
      } catch (assignErr) {
        console.error(`❌ Rider assignment failed for order ${orderId}:`, assignErr?.message || assignErr)
      }

    }

    if (status === 'delivered' && role === 'rider') {
      const rider = await riderModel.getByUserId(req.user.id)
      if (rider) {
        await riderModel.setAvailable(rider.id, true)
        await riderModel.updateStats(rider.id, (rider.total_deliveries || 0) + 1)
      }
    }

    res.json({ order: updated, historyWriteFailed })
  } catch (err) {
    next(err)
  }
}
