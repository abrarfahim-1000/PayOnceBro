import { Router } from 'express'
import { protect } from '../middleware/authMiddleware.js'
import { restrictTo } from '../middleware/roleMiddleware.js'
import { getRecommendations } from '../controllers/recommendationController.js'

const router = Router()

// GET /api/recommendations?userLat=...&userLng=...
router.get('/', protect, restrictTo('user'), getRecommendations)

export default router
