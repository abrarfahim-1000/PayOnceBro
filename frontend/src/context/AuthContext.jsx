import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, logout as apiLogout } from "../services/authService";
import supabase from "../lib/supabase";

const urlcontext = createContext()

const UrlProvider = ({children}) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(false)
    const [authSyncing, setAuthSyncing] = useState(false)
    const [isSessionLoaded, setIsSessionLoaded] = useState(false)
    const didBootstrapRef = useRef(false)
    const isFetchingRef = useRef(false)
    const isAuthenticated = Boolean(user && (user.aud === "authenticated" || user.email))

    const lastFetchedRef = useRef(0)

    const fetchuser = useCallback(async (options = {}) => {
        const force = typeof options === 'boolean' ? options : Boolean(options?.force)
        if (isFetchingRef.current) return
        // Cooldown: Don't hammer the API on every tab focus (60s cooldown)
        if (!force && Date.now() - lastFetchedRef.current < 60000) return

        isFetchingRef.current = true
        if (force) setAuthSyncing(true)
        // Only show loading spinner on initial load to prevent UI flickering on tab focus
        setLoading(prev => !user && prev === false ? true : prev)
        
        try {
            const data = await getCurrentUser()
            lastFetchedRef.current = Date.now()
            setUser(prev => {
                if (!data) return null
                if (!prev) return data
                if (prev.id === data.id && 
                    prev.role === data.role && 
                    prev.delivery_lat === data.delivery_lat &&
                    prev.delivery_lng === data.delivery_lng) {
                    return prev
                }
                return data
            })
        } catch (error) {
            console.error('Error fetching user:', error)
        } finally {
            setLoading(false)
            if (force) setAuthSyncing(false)
            isFetchingRef.current = false
        }
    }, [user])

    const logout = async () => {
        try {
            await apiLogout()
        } catch (error) {
            console.error('Error logging out:', error)
            throw error
        }
    }

    useEffect(() => {
        let didCancel = false

        // Bootstrap immediately
        ;(async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (didCancel) return

                if (session && !didBootstrapRef.current) {
                    didBootstrapRef.current = true
                    const sessionUser = session.user
                    setUser({
                        ...sessionUser,
                        role: sessionUser.user_metadata?.role || 'user',
                        full_name: sessionUser.user_metadata?.full_name || null,
                        username: sessionUser.user_metadata?.username || null,
                    })
                    fetchuser({ force: true })
                }
                setIsSessionLoaded(true)
            } catch {
                if (didCancel) return
                setIsSessionLoaded(true)
            }
        })()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (didCancel) return

                if (event === 'INITIAL_SESSION') {
                    if (session && !didBootstrapRef.current) {
                        didBootstrapRef.current = true
                        const sessionUser = session.user
                        setUser({
                            ...sessionUser,
                            role: sessionUser.user_metadata?.role || 'user',
                        })
                        fetchuser({ force: true })
                    }
                    setIsSessionLoaded(true)
                    return
                }

                if (event === 'SIGNED_IN') {
                    if (session) {
                        const sessionUser = session.user
                        const sessionRole = sessionUser.user_metadata?.role || 'user'
                        setUser(prev => {
                            // If we already have a user with the same ID and role, don't trigger a re-render
                            if (prev && prev.id === sessionUser.id && prev.role === sessionRole) {
                                return prev
                            }
                            return prev ? { ...prev, ...sessionUser } : {
                                ...sessionUser,
                                role: sessionRole,
                            }
                        })
                    }
                    fetchuser({ force: true })
                    return
                }

                if (event === 'SIGNED_OUT') {
                    setUser(null)
                    // Reset any cached fetch timing so the next login (possibly different role)
                    // immediately refreshes the authoritative role from /auth/me.
                    lastFetchedRef.current = 0
                    isFetchingRef.current = false
                    didBootstrapRef.current = false
                    setAuthSyncing(false)
                    setIsSessionLoaded(true)
                }
            }
        )

        return () => {
            didCancel = true
            subscription.unsubscribe()
        }
    }, [fetchuser])

    const value = useMemo(() => ({
        user,
        fetchuser,
        loading,
        authSyncing,
        isAuthenticated,
        isSessionLoaded,
        logout,
    }), [user, fetchuser, loading, authSyncing, isAuthenticated, isSessionLoaded])

    return (
        <urlcontext.Provider value={value}>
            {children}
        </urlcontext.Provider>
    )
}

export { UrlProvider }

export const UrlState = () => {
    return useContext(urlcontext)
}

/**
 * Hook to guard protected pages — redirects to /auth if unauthenticated.
 * @param {boolean} skipCheck - Pass true to skip the check (e.g. on the auth page itself)
 */
export const useAuthCheck = (skipCheck = false) => {
    const navigate = useNavigate()
    const { user, isAuthenticated, loading, isSessionLoaded, logout } = UrlState()

    useEffect(() => {
        if (skipCheck) return
        if (loading || !isSessionLoaded) return
        if (!isAuthenticated && isSessionLoaded) {
            navigate('/auth')
        }
    }, [isAuthenticated, loading, isSessionLoaded, navigate, skipCheck])

    return {
        user,
        isAuthenticated,
        loading: loading || !isSessionLoaded,
        logout
    }
}

