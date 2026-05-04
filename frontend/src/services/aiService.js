import api from './api'

export const getRecommendations = async ({ userLat, userLng }) => {
  const { data } = await api.get('/recommendations', {
    params: { userLat, userLng },
  })
  return data
}

export const buildCombo = async ({ prompt, userLat, userLng }) => {
  const { data } = await api.post('/ai/combo', {
    prompt,
    userLat,
    userLng,
  })
  return data
}
