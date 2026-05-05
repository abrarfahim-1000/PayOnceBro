import api from './api'
import supabase from '../lib/supabase'

export async function login({ email, password }) {
  const { data } = await api.post('/auth/login', { email, password })

  if (data.token) {
    localStorage.setItem('token', data.token)
  }

  // Hand the session back to the Supabase client so onAuthStateChange fires
  // and real-time subscriptions have a valid token
  if (data.session) {
    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })
  }

  return data
}

export async function signup({ email, password, role, username, full_name }) {
  const { data } = await api.post('/auth/register', {
    email,
    password,
    role,
    username,
    full_name,
  })

  if (data.token) {
    localStorage.setItem('token', data.token)
  }

  if (data.session) {
    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })
  }

  // When Supabase requires email confirmation, session is null.
  // Surface this so the UI can prompt the user instead of navigating away.
  return { ...data, requiresEmailConfirmation: !data.session }
}

export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  try {
    const { data } = await api.get('/auth/me', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })
    return data.user
  } catch (err) {
    const status = err?.response?.status
    // If it's a 401 (unauthorized) or 403 (forbidden), the session is truly dead.
    if (status === 401 || status === 403) {
      return null
    }
    // For 500s or network issues, we throw so the AuthContext preserves the optimistic user.
    throw err
  }
}

/** Persists delivery coords from the location picker (customer profiles only). */
export async function updateSavedDeliveryLocation({ lat, lng }) {
  const { data } = await api.patch('/auth/me/delivery-location', { lat, lng })
  return data
}

export async function logout() {
  try {
    await api.post('/auth/logout')
  } catch {
    // Even if server-side logout fails, clear the local session
  }
  try {
    localStorage.removeItem('token')
  } catch {
    // Ignore storage errors
  }
  try {
    await supabase.auth.signOut()
  } catch {
    // Ignore — local token is cleared regardless
  }
  return true
}
