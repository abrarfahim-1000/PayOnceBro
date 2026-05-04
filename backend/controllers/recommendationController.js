import * as recommendationService from '../services/recommendationService.js'

export const getRecommendations = async (req, res, next) => {
  try {
    const userLat = Number(req.query.userLat)
    const userLng = Number(req.query.userLng)

    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      return res.status(400).json({ message: 'userLat and userLng query params are required' })
    }

    const data = await recommendationService.getRecommendations({
      userId: req.user?.id,
      userLat,
      userLng,
    })

    res.json(data)
  } catch (err) {
    next(err)
  }
}
