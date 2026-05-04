import * as restaurantModel from '../models/restaurantModel.js'
import * as menuModel from '../models/menuModel.js'
import { getNearbyClusteredRestaurants } from '../services/clusteringService.js'
import { buildCombo as buildComboWithGemini } from '../services/geminiService.js'
import { haversineDistance } from '../utils/geoUtils.js'

const MAX_PROMPT_LENGTH = Number(process.env.COMBO_PROMPT_MAX_LENGTH) || 240
const MAX_CONTEXT_ITEMS = Number(process.env.COMBO_CONTEXT_MAX_ITEMS) || 80
const MAX_ITEM_QUANTITY = Number(process.env.COMBO_MAX_ITEM_QUANTITY) || 5

/** When no multi-restaurant clusters exist near the user, still allow combos from restaurants within this radius (km). */
const COMBO_FALLBACK_RADIUS_KM = Number(process.env.COMBO_FALLBACK_RADIUS_KM) || 15

const DIETARY_TAGS = [
  'vegan',
  'vegetarian',
  'halal',
  'gluten-free',
  'dairy-free',
  'high-protein',
  'low-calorie',
]

const parseBudgetTk = (prompt) => {
  if (typeof prompt !== 'string') return null
  const p = prompt.toLowerCase()

  const patterns = [
    /under\s*(\d{2,6})/i,
    /below\s*(\d{2,6})/i,
    /<=\s*(\d{2,6})/i,
    /≤\s*(\d{2,6})/i,
  ]

  for (const re of patterns) {
    const m = p.match(re)
    if (m?.[1]) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n > 0) return n
    }
  }

  return null
}

const extractDietaryNeeds = (prompt) => {
  if (typeof prompt !== 'string') return []
  const lower = prompt.toLowerCase()
  return DIETARY_TAGS.filter((tag) => lower.includes(tag))
}

const normalizeGeminiItems = (items) => {
  if (!Array.isArray(items)) return []

  const idStr = (v) => {
    if (v == null) return null
    const s = String(v).trim()
    return s.length ? s : null
  }

  return items
    .map((it) => {
      const rawMid = it?.menuItemId ?? it?.menu_item_id
      const rawRid = it?.restaurantId ?? it?.restaurant_id
      return {
        menuItemId: idStr(rawMid),
        restaurantId: idStr(rawRid),
        quantity: Number.isFinite(Number(it?.quantity))
          ? Math.min(MAX_ITEM_QUANTITY, Math.max(1, Math.floor(Number(it.quantity))))
          : 1,
      }
    })
    .filter((it) => it.menuItemId && it.restaurantId && it.quantity > 0)
}

const sumTotal = (selected) => {
  return Number(
    (selected ?? []).reduce((sum, row) => sum + Number(row.menuItem.price || 0) * Number(row.quantity || 0), 0).toFixed(2)
  )
}

const enforceBudget = (selected, budgetTk) => {
  if (!Number.isFinite(budgetTk) || budgetTk <= 0) return { selected, trimmed: false }

  const sorted = [...(selected ?? [])].sort((a, b) => Number(b.menuItem.price || 0) - Number(a.menuItem.price || 0))
  let kept = [...sorted]

  while (kept.length > 0 && sumTotal(kept) > budgetTk) {
    kept = kept.slice(1)
  }

  return { selected: kept, trimmed: kept.length !== sorted.length }
}

export const buildCombo = async (req, res, next) => {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : ''
    const userLat = Number(req.body?.userLat)
    const userLng = Number(req.body?.userLng)

    if (!prompt) {
      return res.status(400).json({ message: 'prompt is required' })
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({ message: `prompt must be <= ${MAX_PROMPT_LENGTH} characters` })
    }

    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      return res.status(400).json({ message: 'userLat and userLng are required' })
    }

    const allRestaurants = await restaurantModel.getAllActive()
    const clusters = getNearbyClusteredRestaurants(allRestaurants, userLat, userLng)

    let restaurantIds = [...new Set(clusters.flatMap((c) => c.restaurants.map((r) => r.id)).filter(Boolean))]

    if (!restaurantIds.length) {
      restaurantIds = [
        ...new Set(
          allRestaurants
            .filter((r) => {
              if (r.lat == null || r.lng == null) return false
              return haversineDistance(userLat, userLng, r.lat, r.lng) <= COMBO_FALLBACK_RADIUS_KM
            })
            .map((r) => r.id)
            .filter(Boolean)
        ),
      ]
    }

    if (!restaurantIds.length) {
      const nearest = [...allRestaurants]
        .filter((r) => r.lat != null && r.lng != null && r.id)
        .map((r) => ({
          id: r.id,
          d: haversineDistance(userLat, userLng, r.lat, r.lng),
        }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 50)
      restaurantIds = [...new Set(nearest.map((x) => x.id).filter(Boolean))]
    }

    if (!restaurantIds.length) {
      return res.status(400).json({
        message: 'No restaurants with map coordinates in the database. Add lat/lng to restaurants.',
      })
    }

    const allMenuRows = await menuModel.getAvailableByRestaurantIds(restaurantIds, 600)
    if (!allMenuRows.length) {
      return res.status(400).json({ message: 'No menu items available in nearby restaurants' })
    }

    const dietaryNeeds = extractDietaryNeeds(prompt)
    const filteredByDiet = dietaryNeeds.length
      ? allMenuRows.filter((row) => {
          const tags = Array.isArray(row.ai_tags) ? row.ai_tags.map((t) => String(t).toLowerCase()) : []
          return dietaryNeeds.every((need) => tags.includes(need))
        })
      : allMenuRows

    // Do not 400 when tags are missing: most items use [] and would fail a strict tag filter.
    const candidateRows = filteredByDiet.length ? filteredByDiet : allMenuRows

    // Keep Gemini context bounded.
    const contextRows = [...candidateRows]
      .sort((a, b) => Number(b.restaurants?.avg_rating || 0) - Number(a.restaurants?.avg_rating || 0))
      .slice(0, MAX_CONTEXT_ITEMS)

    const dietHint =
      dietaryNeeds.length > 0
        ? `\nUser dietary preferences (honour when choosing): ${dietaryNeeds.join(', ')}. Prefer items whose aiTags match; if none match, choose the closest reasonable options.`
        : ''

    const menuContext = contextRows.map((row) => ({
      menuItemId: row.id,
      name: row.name,
      price: row.price,
      restaurantId: row.restaurant_id,
      restaurantName: row.restaurants?.name,
      aiTags: row.ai_tags ?? [],
      description: row.description,
    }))

    const combo = await buildComboWithGemini(`${prompt}${dietHint}`, menuContext)
    const normalized = normalizeGeminiItems(combo?.items)

    if (!normalized.length) {
      return res.status(400).json({ message: combo?.explanation || 'Could not generate combo. Please try again.' })
    }

    const byMenuItemId = new Map(candidateRows.map((r) => [String(r.id), r]))

    const selected = normalized
      .map((it) => {
        const row = byMenuItemId.get(String(it.menuItemId))
        if (!row) return null
        if (String(row.restaurant_id) !== String(it.restaurantId)) return null

        return {
          menuItem: {
            id: row.id,
            name: row.name,
            description: row.description,
            price: row.price,
            category: row.category,
            aiTags: row.ai_tags ?? [],
            restaurantId: row.restaurant_id,
          },
          restaurant: {
            id: row.restaurants?.id,
            name: row.restaurants?.name,
            address: row.restaurants?.address,
            lat: row.restaurants?.lat,
            lng: row.restaurants?.lng,
            avgRating: row.restaurants?.avg_rating,
            avgPrepTime: row.restaurants?.avg_prep_time,
          },
          quantity: it.quantity,
        }
      })
      .filter(Boolean)

    if (!selected.length) {
      return res.status(400).json({ message: 'Some suggested items are no longer available' })
    }

    const budgetTk = parseBudgetTk(prompt)
    const { selected: budgetSelected, trimmed } = enforceBudget(selected, budgetTk)

    if (budgetTk != null && budgetSelected.length === 0) {
      return res.status(400).json({ message: `Could not build a combo under ৳${budgetTk}. Try increasing your budget.` })
    }

    const totalPrice = sumTotal(budgetSelected)

    res.json({
      suggestedItems: budgetSelected,
      totalPrice,
      explanation: combo?.explanation || 'Here is a combo you might like.',
      budgetApplied: budgetTk != null,
      budgetTrimmed: Boolean(trimmed),
      dietaryApplied: dietaryNeeds,
    })
  } catch (err) {
    next(err)
  }
}

export const __testables = {
  parseBudgetTk,
  extractDietaryNeeds,
  normalizeGeminiItems,
  enforceBudget,
  sumTotal,
}
