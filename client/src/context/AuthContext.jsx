import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler, tokenExpiry } from '../services/api'

const AuthContext = createContext(null)

const CHECK_EVERY_MS = 60_000
const ACTIVE_WITHIN_MS = 5 * 60_000 // counts as "active" if the user did something in the last 5 minutes
const REFRESH_WHEN_LEFT_MS = 20 * 60_000 // refresh once less than 20 minutes of the session remain

// Keeps the session alive while the user is active; when they go idle the token simply expires.
function useSessionKeeper(user, logout) {
  useEffect(() => {
    if (!user) return undefined
    let lastActivity = Date.now()
    const markActive = () => { lastActivity = Date.now() }
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }))

    const check = async () => {
      const expiresAt = tokenExpiry(getToken())
      if (!expiresAt) return
      const left = expiresAt - Date.now()
      if (left <= 0) return logout('inactive')
      if (left < REFRESH_WHEN_LEFT_MS && Date.now() - lastActivity < ACTIVE_WITHIN_MS) {
        try {
          const { token } = await api.post('/auth/refresh')
          setToken(token)
        } catch {
          // A failed refresh is handled by the 401 handler, or retried on the next check.
        }
      }
    }
    const timer = setInterval(check, CHECK_EVERY_MS)
    // Also check straight away when the tab comes back into view after being in the background.
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      events.forEach((e) => window.removeEventListener(e, markActive))
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user, logout])
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(getToken()))
  // Why the last session ended ('inactive' or 'expired'), shown on the login page.
  const [logoutReason, setLogoutReason] = useState(null)

  const logout = useCallback((reason = null) => {
    setToken(null)
    setUser(null)
    setLogoutReason(typeof reason === 'string' ? reason : null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => logout('expired'))
    if (!getToken()) return
    api.get('/auth/me')
      .then(setUser)
      .catch(() => logout('expired'))
      .finally(() => setLoading(false))
  }, [logout])

  useSessionKeeper(user, logout)

  const login = async (email, password) => {
    const { token, user: u } = await api.post('/auth/login', { email, password })
    setToken(token)
    setUser(u)
    setLogoutReason(null)
    return u
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, logoutReason }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
