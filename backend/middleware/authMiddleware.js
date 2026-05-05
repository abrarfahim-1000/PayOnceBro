import supabase from '../config/db.js'
import { normalizeRole } from '../utils/normalizeRole.js'
import jwt from 'jsonwebtoken'

const AUTH_CACHE_TTL_MS = 2 * 60 * 1000
const authCache = new Map()
const inFlightLookups = new Map()

const getCachedAuth = (token) => {
  const cached = authCache.get(token)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    authCache.delete(token)
    return null
  }
  return cached.auth
}

const setCachedAuth = (token, auth) => {
  authCache.set(token, { auth, expiresAt: Date.now() + AUTH_CACHE_TTL_MS })
}

const getUserFromTokenLocally = (token) => {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) return null

  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'], audience: 'authenticated' })

    if (!payload || typeof payload !== 'object') return null

    const id = payload.sub
    if (!id || typeof id !== 'string') return null

    const email =
      typeof payload.email === 'string'
        ? payload.email
        : typeof payload?.user_metadata?.email === 'string'
          ? payload.user_metadata.email
          : null

    const user_metadata = typeof payload.user_metadata === 'object' && payload.user_metadata ? payload.user_metadata : {}

    return {
      id,
      email,
      user_metadata,
    }
  } catch {
    return null
  }
}

export const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) {
      return res.status(401).json({ message: 'Not authorised, no token' })
    }

    // 1. Check if we have this full auth context (user + role) cached
    const cachedAuth = getCachedAuth(token)
    if (cachedAuth) {
      req.user = cachedAuth
      return next()
    }

    // 2. Handle deduplication for multiple requests using the same token
    const existingLookup = inFlightLookups.get(token)
    if (existingLookup) {
      const result = await existingLookup
      if (!result) {
        return res.status(401).json({ message: 'Not authorised, token invalid' })
      }
      req.user = result
      return next()
    }


    const lookupPromise = (async () => {
      try {
        // A. Identify the user (Local JWT decode or Supabase API fallback)
        const localUser = getUserFromTokenLocally(token)
        let user = localUser

        if (!user) {
          const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token)
          if (error || !supabaseUser) return null
          user = supabaseUser
        }

        // B. Fetch the authoritative role from the profiles table
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        // Handle database errors (timeout, connection, etc.)
        if (profileError && profileError.code !== 'PGRST116') {
          throw new Error('PROFILE_LOOKUP_FAILED')
        }

        const dbRole = profile ? normalizeRole(profile.role) : null
        
        // Use JWT metadata as a fallback only if the DB profile row is missing.
        // This handles race conditions where the auth account exists but the profile row is still being created.
        const jwtRole = user.user_metadata?.role ? normalizeRole(user.user_metadata.role) : null
        const safeFallbackRole = normalizeRole('user')
        
        const authContext = {
          id: user.id,
          email: user.email,
          role: dbRole || jwtRole || safeFallbackRole,
        }

        setCachedAuth(token, authContext)
        return authContext
      } finally {
        inFlightLookups.delete(token)
      }
    })()

    inFlightLookups.set(token, lookupPromise)
    const result = await lookupPromise

    if (!result) {
      return res.status(401).json({ message: 'Not authorised, token invalid' })
    }

    req.user = result
    next()
  } catch (err) {
    if (err.message === 'PROFILE_LOOKUP_FAILED') {
      return res.status(401).json({ message: 'Not authorised, user profile lookup failed' })
    }
    res.status(401).json({ message: 'Not authorised' })
  }
}

