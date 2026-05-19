import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { loginRequest } from '../api/auth'
import { TOKEN_STORAGE_KEY } from '../config'

export type AuthUser = {
  id?: string
  name: string
  email: string
  role: string
}

type AuthState = {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

const STORAGE_KEY = 'greencare-admin-user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as AuthUser) : null
    } catch {
      return null
    }
  })

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginRequest(email, password)
    const u: AuthUser = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      role: data.user.role,
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(TOKEN_STORAGE_KEY)
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
