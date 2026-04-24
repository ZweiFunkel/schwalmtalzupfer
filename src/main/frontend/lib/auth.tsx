'use client'
import { getApiBase } from '@/lib/api'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export interface AuthUser {
  email: string
  username: string
  vorname: string
  nachname: string
  role: string
  istAktiv: boolean
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  refresh: async () => {},
})

const API_BASE = getApiBase()

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  const login = async (email: string, password: string) => {
    const body = new URLSearchParams({ username: email, password })
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      credentials: 'include',
      body: body.toString(),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login fehlgeschlagen' }))
      throw new Error(err.error ?? 'Login fehlgeschlagen')
    }
    await refresh()
  }

  const logout = async () => {
    await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

export const isAdmin = (user: AuthUser | null) => user?.role === 'ROLE_ADMIN'
export const isBoard = (user: AuthUser | null) => ['ROLE_ADMIN', 'ROLE_BOARD'].includes(user?.role ?? '')
export const isMember = (user: AuthUser | null) => ['ROLE_ADMIN', 'ROLE_BOARD', 'ROLE_MEMBER'].includes(user?.role ?? '')
export const isGuest = (user: AuthUser | null) => user !== null
export const isGuestOnly = (user: AuthUser | null) => user?.role === 'ROLE_GUEST'

