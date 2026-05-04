import axios from 'axios'
import supabase from '../lib/supabase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
})

// Attach the Supabase session token when available. Never block the request if
// getSession() rejects or misbehaves — otherwise axios never leaves the client.
api.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }
  } catch (e) {
    console.warn('[api] getSession failed; continuing without auth header', e?.message || e)
  }
  return config
})

export default api
