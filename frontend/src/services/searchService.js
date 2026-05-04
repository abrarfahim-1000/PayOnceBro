import api from './api'

/**
 * searchFood — asks the backend to find food matching the query + filters.
 *
 * @param {string} query     - what the user typed ("burger", "pasta", etc.)
 * @param {object} filters   - { minPrice, maxPrice, cuisine, userLat, userLng }
 * @returns { results: [...], total: number }
 */
export const searchFood = async (query = '', filters = {}) => {
  const params = new URLSearchParams()

  if (query) params.set('q', query)
  if (filters.minPrice) params.set('minPrice', filters.minPrice)
  if (filters.maxPrice) params.set('maxPrice', filters.maxPrice)
  if (filters.cuisine) params.set('cuisine', filters.cuisine)
  if (filters.userLat !== undefined && filters.userLat !== null && filters.userLat !== '') params.set('userLat', filters.userLat)
  if (filters.userLng !== undefined && filters.userLng !== null && filters.userLng !== '') params.set('userLng', filters.userLng)
  if (filters.limit != null && filters.limit !== '') params.set('limit', String(filters.limit))
  if (filters.offset != null && filters.offset !== '') params.set('offset', String(filters.offset))

  const { data } = await api.get(`/search?${params.toString()}`)
  return data
}

/**
 * getCategories — fetches all food categories for the filter dropdown.
 */
export const getCategories = async () => {
  const { data } = await api.get('/search/categories')
  return data.categories ?? []
}

/**
 * Map context for LocationPickerMap: DB restaurants + cluster polylines.
 */
export const getSearchMap = async () => {
  const { data } = await api.get('/search/map')
  return data
}