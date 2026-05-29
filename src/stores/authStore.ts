import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type AuthStoreState = {
  accessToken: string | null
  setAccessToken: (token: string | null) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set) => ({
      accessToken: null,
      setAccessToken: (accessToken) => set({ accessToken }),
      clearAuth: () => set({ accessToken: null }),
    }),
    { name: 'greencare-auth-store' },
  ),
)
