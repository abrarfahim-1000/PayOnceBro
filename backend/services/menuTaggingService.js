import { generateMenuTags } from './geminiService.js'

export const inferFallbackTags = (name = '', description = '') => {
  const text = `${name} ${description}`.toLowerCase()
  const tags = new Set()
  const hasMeat = /\b(beef|chicken|mutton|lamb|prawn|shrimp|fish|tuna|salmon)\b/.test(text)

  if (/\bvegan\b|tofu|plant\s*-?\s*based/.test(text)) tags.add('vegan')
  if ((/\bvegetarian\b|paneer|veggie/.test(text) || (/vegetable/.test(text) && !hasMeat)) && !hasMeat) {
    tags.add('vegetarian')
  }
  if (/\bhalal\b|beef|chicken|mutton|lamb/.test(text)) tags.add('halal')
  if (/spicy|chili|chilli|hot\b|jalapeno|pepper/.test(text)) tags.add('spicy')
  if (/\bmild\b|lightly\s+spiced|butter/.test(text)) tags.add('mild')
  if (/sweet|dessert|cake|chocolate|honey|sugar/.test(text)) tags.add('sweet')
  if (/gluten\s*-?\s*free|\bgf\b/.test(text)) tags.add('gluten-free')
  if (/dairy\s*-?\s*free|lactose\s*-?\s*free/.test(text) || tags.has('vegan')) tags.add('dairy-free')
  if (/high\s*-?\s*protein|protein\b|beef|chicken|egg/.test(text)) tags.add('high-protein')
  if (/low\s*-?\s*calorie|salad|steamed|grilled/.test(text)) tags.add('low-calorie')

  return Array.from(tags)
}

/**
 * Gemini tags merged with rule-based fallbacks (same behavior as restaurant menu CRUD).
 */
export const buildMenuTags = async (name = '', description = '') => {
  const fallback = inferFallbackTags(name, description)

  try {
    const aiTags = await generateMenuTags(name, description)
    if (Array.isArray(aiTags) && aiTags.length > 0) {
      return [...new Set([...aiTags, ...fallback])]
    }
  } catch {
    // use fallback only
  }

  return fallback
}
