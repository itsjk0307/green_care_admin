import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  LoginPendingError,
  LoginRejectedError,
  loginRequest,
} from '../api/auth'
import { TOKEN_STORAGE_KEY } from '../config'
import { canAccessAdminPanel } from '../lib/roles'
import { useAuthStore } from '../stores/authStore'
import { useLanguageStore } from '../stores/languageStore'

export type AuthUser = {
  id?: string
  name: string
  email: string
  role: string
  accountStatus?: string
  assignedCourseId?: string
}

type AuthState = {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)
const STORAGE_KEY = 'greencare-admin-user'

function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  useAuthStore.getState().clearAuth()
}

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const u = JSON.parse(raw) as AuthUser
    if (!canAccessAdminPanel(u.role)) {
      clearStoredAuth()
      return null
    }
    return u
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY)
    const u = readStoredUser()
    if (token && u) {
      useAuthStore.getState().setAccessToken(token)
    } else if (token && !u) {
      clearStoredAuth()
    }
  }, [])

  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser())

  const login = useCallback(async (email: string, password: string) => {
    const outcome = await loginRequest(email, password)

    if (outcome.kind === 'pending') {
      clearStoredAuth()
      const t = useLanguageStore.getState().t
      throw new LoginPendingError(
        outcome.message?.trim() || t('loginPendingError'),
      )
    }

    if (outcome.kind === 'rejected') {
      clearStoredAuth()
      const t = useLanguageStore.getState().t
      throw new LoginRejectedError(
        outcome.message?.trim() || t('loginRejectedError'),
      )
    }

    if (!canAccessAdminPanel(outcome.user.role)) {
      clearStoredAuth()
      throw new Error(useLanguageStore.getState().t('staffOnlyLoginError'))
    }

    const u: AuthUser = {
      id: outcome.user.id,
      email: outcome.user.email,
      name: outcome.user.name,
      role: outcome.user.role,
      accountStatus: outcome.user.account_status,
      assignedCourseId: outcome.user.assigned_course_id ?? undefined,
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, outcome.access_token)
    useAuthStore.getState().setAccessToken(outcome.access_token)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    clearStoredAuth()
  }, [])

  const value = useMemo(
    () => ({ user, login, logout }),
    [user, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthProvider 안에서 useAuth를 사용하세요.')
  return ctx
}
