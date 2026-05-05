import axios, { AxiosHeaders } from 'axios'
import supabase from '../lib/supabase'

let cachedAccessToken = null
let didInitTokenListener = false
let isSigningOut = false

const ensureTokenListener = () => {
  if (didInitTokenListener) return
  didInitTokenListener = true

  // Seed once on module init.
  supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      cachedAccessToken = session?.access_token ?? null
    })
    .catch(() => {
      cachedAccessToken = null
    })

  supabase.auth.onAuthStateChange((_event, session) => {
    cachedAccessToken = session?.access_token ?? null
  })
}

const getFallbackTokenFromStorage = () => {
  try {
    const token = localStorage.getItem('token')
    return token && typeof token === 'string' && token.trim() ? token.trim() : null
  } catch {
    return null
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
})

api.interceptors.request.use(async (config) => {
  ensureTokenListener()

  // Always get the latest session directly from Supabase.
  // This is fast (local storage lookup) and handles token refresh automatically.
  let sessionToken = null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    sessionToken = session?.access_token ?? null
  } catch {
    sessionToken = null
  }

  const token = sessionToken || cachedAccessToken || getFallbackTokenFromStorage()

  if (!token) return config

  // Never attach bearer tokens to requests outside our API origin.
  try {
    const base = config.baseURL || api.defaults.baseURL
    const resolved = new URL(config.url ?? '', base)
    const apiOrigin = new URL(api.defaults.baseURL).origin
    if (resolved.origin !== apiOrigin) return config
  } catch {
    // If URL parsing fails, be conservative and don't attach auth.
    return config
  }

  const headers = AxiosHeaders.from(config.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return { ...config, headers }
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status
    const url = error?.config?.url || ''

    const isAuthEndpoint = /(^|\/|\\)auth\/(login|register)(\/|$)/i.test(String(url))

    // If the API says we're unauthorized, clear local tokens so we don't spam
    // the backend with repeated failing requests.
    if (status === 401 && !isAuthEndpoint && !isSigningOut) {
      isSigningOut = true
      cachedAccessToken = null
      try {
        localStorage.removeItem('token')
      } catch {
        // ignore
      }
      try {
        // Best-effort: clear Supabase persisted session.
        await supabase.auth.signOut()
      } catch {
        // ignore
      } finally {
        isSigningOut = false
      }
    }

    return Promise.reject(error)
  }
)


export default api

// Initialize listener once on module load.
ensureTokenListener()
