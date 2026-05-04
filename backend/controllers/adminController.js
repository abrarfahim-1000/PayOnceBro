import * as analyticsService from '../services/analyticsService.js'
import * as demandService from '../services/demandService.js'
import * as menuModel from '../models/menuModel.js'
import { buildMenuTags } from '../services/menuTaggingService.js'

export const getAnalytics = async (req, res, next) => {
  try {
    const data = await analyticsService.getAnalytics()
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export const getDemandZones = async (req, res, next) => {
  try {
    const zones = demandService.getDemandZones()
    res.json({ zones, timestamp: new Date().toISOString() })
  } catch (error) {
    next(error)
  }
}
const tagsLookEmpty = (aiTags) => {
  if (aiTags == null) return true
  if (Array.isArray(aiTags)) return aiTags.length === 0
  if (typeof aiTags === 'object') return Object.keys(aiTags).length === 0
  return false
}

/**
 * POST /api/admin/menu/backfill-ai-tags
 * Body: { limit?: number (1–100, default 30), force?: boolean }
 * Recomputes ai_tags via Gemini + fallbacks for available menu_items and persists to DB.
 */
export const backfillMenuAiTags = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.body?.limit) || 30, 1), 100)
    const force = Boolean(req.body?.force)

    const rows = await menuModel.listMenuItemsForTaggingCandidates(2000)
    const targets = rows
      .filter((r) => force || tagsLookEmpty(r.ai_tags))
      .slice(0, limit)

    const results = []
    for (const row of targets) {
      try {
        const tags = await buildMenuTags(row.name, row.description)
        await menuModel.updateTags(row.id, tags)
        results.push({ id: row.id, name: row.name, ok: true, tags })
      } catch (err) {
        results.push({
          id: row.id,
          name: row.name,
          ok: false,
          message: err?.message || 'Update failed',
        })
      }
    }

    res.json({
      scanned: rows.length,
      requestedLimit: limit,
      force,
      processed: results.length,
      results,
    })
  } catch (err) {
    next(err)
  }
}
