import supabase from '../config/db.js'

const clampInt = (v, def, min, max) => {
  const n = parseInt(v, 10)
  if (Number.isNaN(n)) return def
  return Math.min(Math.max(n, min), max)
}

const matchesQuery = (item, q) => {
  const name = item.name?.toLowerCase() ?? ''
  const description = item.description?.toLowerCase() ?? ''
  const category = item.category?.toLowerCase() ?? ''
  const aiTags = Array.isArray(item.ai_tags)
    ? item.ai_tags.map((tag) => String(tag).toLowerCase())
    : []
  return (
    name.includes(q) ||
    description.includes(q) ||
    category.includes(q) ||
    aiTags.some((tag) => tag.includes(q))
  )
}

/**
 * searchItems — finds food items matching a search query + filters.
 *
 * @param {string} query      - what the user typed, e.g. "burger"
 * @param {object} filters    - { minPrice, maxPrice, cuisine, limit, offset }
 * @returns { items: rows[], meta: { hasMore: boolean } }
 */
export const searchItems = async (query = '', filters = {}) => {
  const { minPrice, maxPrice, cuisine } = filters
  const limit = clampInt(filters.limit, 50, 1, 100)
  const offset = clampInt(filters.offset, 0, 0, 10_000)
  const q = query?.trim().toLowerCase() ?? ''

  let dbQuery = supabase
    .from('menu_items')
    .select(`
      id,
      name,
      description,
      price,
      category,
      is_available,
      ai_tags,
      restaurant_id,
      restaurants (
        id,
        name,
        address,
        lat,
        lng,
        avg_rating,
        is_active,
        avg_prep_time
      )
    `)
    .eq('is_available', true)

  if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
    dbQuery = dbQuery.gte('price', Number(minPrice))
  }

  if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
    dbQuery = dbQuery.lte('price', Number(maxPrice))
  }

  if (cuisine && cuisine.trim().length > 0) {
    dbQuery = dbQuery.ilike('category', `%${cuisine.trim()}%`)
  }

  dbQuery = dbQuery.order('price', { ascending: true })

  if (!q) {
    const { data, error } = await dbQuery.range(offset, offset + limit - 1)
    if (error) throw error
    const raw = data ?? []
    const filtered = raw.filter((item) => item.restaurants && item.restaurants.is_active === true)
    return {
      items: filtered,
      meta: {
        hasMore: raw.length === limit,
        nextOffset: offset + raw.length,
      },
    }
  }

  const poolCap = Math.min(400, Math.max(offset + limit + 80, 120))
  const { data, error } = await dbQuery.range(0, poolCap - 1)
  if (error) throw error
  const filtered = (data ?? [])
    .filter((item) => item.restaurants && item.restaurants.is_active === true)
    .filter((item) => matchesQuery(item, q))

  const page = filtered.slice(offset, offset + limit)
  const hasMore = offset + limit < filtered.length

  return {
    items: page,
    meta: {
      hasMore,
      nextOffset: offset + page.length,
    },
  }
}

/**
 * getCategories — returns all unique food categories in the database.
 * Used to populate the cuisine filter dropdown.
 */
export const getCategories = async () => {
  const { data, error } = await supabase
    .from('menu_items')
    .select('category')
    .eq('is_available', true)

  if (error) throw error

  const categories = [
    ...new Set(
      (data ?? [])
        .map((item) => item.category)
        .filter(Boolean)
        .map((c) => c.trim())
    ),
  ].sort()

  return categories
}

/**
 * getByIds — fetch menu items by IDs for order validation and pricing.
 */
export const getByIds = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return []

  const { data, error } = await supabase
    .from('menu_items')
    .select('id, name, price, is_available, restaurant_id')
    .in('id', ids)

  if (error) throw error
  return data ?? []
}

/**
 * updateTags — updates ai_tags for a menu item.
 */
export const updateTags = async (itemId, tags = []) => {
  const { data, error } = await supabase
    .from('menu_items')
    .update({ ai_tags: Array.isArray(tags) ? tags : [] })
    .eq('id', itemId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

const MENU_WITH_RESTAURANT_SELECT = `
  id,
  name,
  description,
  price,
  category,
  is_available,
  ai_tags,
  restaurant_id,
  restaurants (
    id,
    name,
    address,
    lat,
    lng,
    avg_rating,
    is_active,
    avg_prep_time
  )
`

const filterActiveRestaurants = (rows) => {
  return (rows ?? []).filter((item) => item.restaurants && item.restaurants.is_active === true)
}

export const getAvailableByIds = async (ids = []) => {
  if (!Array.isArray(ids) || ids.length === 0) return []

  const { data, error } = await supabase
    .from('menu_items')
    .select(MENU_WITH_RESTAURANT_SELECT)
    .eq('is_available', true)
    .in('id', ids)

  if (error) throw error
  return filterActiveRestaurants(data)
}

export const getAvailableByRestaurantIds = async (restaurantIds = [], limit = 200) => {
  if (!Array.isArray(restaurantIds) || restaurantIds.length === 0) return []

  const { data, error } = await supabase
    .from('menu_items')
    .select(MENU_WITH_RESTAURANT_SELECT)
    .eq('is_available', true)
    .in('restaurant_id', restaurantIds)
    .order('price', { ascending: true })
    .limit(limit)

  if (error) throw error
  return filterActiveRestaurants(data)
}

/**
 * List available menu rows for admin AI tag backfill (id, name, description, ai_tags only).
 */
export const listMenuItemsForTaggingCandidates = async (maxRows = 500) => {
  const cap = Math.min(Math.max(Number(maxRows) || 500, 1), 2000)
  const { data, error } = await supabase
    .from('menu_items')
    .select('id, name, description, ai_tags')
    .eq('is_available', true)
    .limit(cap)

  if (error) throw error
  return data ?? []
}
