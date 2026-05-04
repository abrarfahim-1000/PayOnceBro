import { Router } from 'express'
import { protect } from '../middleware/authMiddleware.js'
import { restrictTo } from '../middleware/roleMiddleware.js'
import { buildCombo } from '../controllers/aiController.js'

const router = Router()

// POST /api/ai/combo
router.post('/combo', protect, restrictTo('user'), buildCombo)

export default router
