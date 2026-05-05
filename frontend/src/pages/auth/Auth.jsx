import React, { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { UrlState } from '../../context/AuthContext'
import Login from './Login'
import Register from './Register'
import { Button } from '../../components/ui/button'
import { getRoleHome } from '../../utils/roleHome'

/**
 * Combined Login / Sign Up page — mount at the /auth route.
 * Always shows the login form for unauthenticated sessions.
 */
const Auth = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, isAuthenticated, authSyncing, isSessionLoaded } = UrlState()
  const [activeForm, setActiveForm] = useState(
    searchParams.get('createNew') ? 'login' : null
  )
  const [isMobileView, setIsMobileView] = useState(false)
  const [showMobileActions, setShowMobileActions] = useState(false)
  const mobileActionsRef = useRef(null)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)')
    const syncViewportState = () => {
      const mobile = mediaQuery.matches
      setIsMobileView(mobile)
    }

    syncViewportState()
    mediaQuery.addEventListener('change', syncViewportState)

    return () => mediaQuery.removeEventListener('change', syncViewportState)
  }, [])

  useEffect(() => {
    if (!mobileActionsRef.current) return

    setShowMobileActions(false)

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowMobileActions(true)
          observer.disconnect()
        }
      },
      {
        threshold: 0.35,
      }
    )

    observer.observe(mobileActionsRef.current)

    return () => observer.disconnect()
  }, [isMobileView])

  useEffect(() => {
    if (!isSessionLoaded || authSyncing || !isAuthenticated || !user) return
    navigate(getRoleHome(user?.role), { replace: true })
  }, [isSessionLoaded, authSyncing, isAuthenticated, user, navigate])

  if (isSessionLoaded && isAuthenticated && user) {
    return null
  }

  return (
    <div className="min-h-screen w-full bg-background lg:grid lg:grid-cols-2">
      <section className="relative min-h-screen">
        <img
          src="/landpage.jpg"
          alt="Hero"
          className="absolute inset-0 h-full w-full object-cover object-right mask-[linear-gradient(to_bottom,black_0%,black_96%,transparent_100%)] lg:mask-[linear-gradient(to_right,black_0%,black_97%,transparent_100%)]"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/65 via-black/30 to-black/15 mask-[linear-gradient(to_bottom,black_0%,black_96%,transparent_100%)] lg:mask-[linear-gradient(to_right,black_0%,black_97%,transparent_100%)]" />
        <div className="relative z-10 flex h-full items-end p-10">
          <div>
            <p className="text-5xl font-black tracking-tight text-white">PayOnceBro</p>
            <p className="mt-2 text-white/90">Order fast. Pay once. Enjoy more.</p>
          </div>
        </div>

        <div className={`absolute bottom-8 left-1/2 z-20 -translate-x-1/2 transition-opacity duration-300 lg:hidden ${showMobileActions ? 'opacity-0' : 'opacity-100'}`}>
          <div className="animate-bounce rounded-full bg-black/45 px-5 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white backdrop-blur-sm">
            Scroll
          </div>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-lg">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl font-extrabold text-foreground">Welcome</h1>
            <p className="mt-2 text-muted-foreground">
              {searchParams.get('createNew') ? 'Please login first' : 'Choose how you want to continue'}
            </p>
          </div>

          <div
            ref={mobileActionsRef}
            className={`mt-8 rounded-2xl border border-border bg-card p-3 shadow-lg transition-all duration-700 ease-out ${
              showMobileActions ? 'translate-y-0 opacity-100' : 'translate-y-14 opacity-0'
            }`}
          >
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => setActiveForm(activeForm === 'login' ? null : 'login')}
                variant={activeForm === 'login' ? 'default' : 'secondary'}
                className="h-12 rounded-xl text-base font-semibold shadow-sm"
              >
                Login
              </Button>
              <Button
                onClick={() => setActiveForm(activeForm === 'signup' ? null : 'signup')}
                variant={activeForm === 'signup' ? 'default' : 'secondary'}
                className="h-12 rounded-xl text-base font-semibold shadow-sm"
              >
                Signup
              </Button>
            </div>
          </div>

          <div
            className={`grid overflow-hidden transition-all duration-500 ease-out ${
              activeForm ? 'mt-6 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="min-h-0">
              {activeForm === 'login' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <Login />
                </div>
              )}
              {activeForm === 'signup' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <Register />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Auth
