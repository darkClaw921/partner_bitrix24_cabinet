import { createContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { type Partner, type RegisterData, getMe, login as apiLogin, register as apiRegister, logout as apiLogout } from '@/api/auth'

interface AuthContextType {
  partner: Partner | null
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<Partner>
  register: (data: RegisterData) => Promise<Partner>
  logout: () => void
  refreshAuth: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [partner, setPartner] = useState<Partner | null>(null)
  const [loading, setLoading] = useState(true)

  const isAuthenticated = partner !== null
  const isAdmin = partner?.role === 'admin'

  const refreshAuth = useCallback(async () => {
    try {
      const data = await getMe()
      setPartner(data)
    } catch {
      setPartner(null)
      apiLogout()
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      refreshAuth().finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [refreshAuth])

  const login = async (email: string, password: string): Promise<Partner> => {
    await apiLogin({ email, password })
    const me = await getMe()
    setPartner(me)
    return me
  }

  const register = async (data: RegisterData): Promise<Partner> => {
    return apiRegister(data)
  }

  const logout = () => {
    apiLogout()
    setPartner(null)
  }

  return (
    <AuthContext.Provider value={{ partner, loading, isAuthenticated, isAdmin, login, register, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}
