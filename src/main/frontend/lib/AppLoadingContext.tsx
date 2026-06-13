'use client'
import React, { createContext, useCallback, useContext, useRef, useState } from 'react'

interface AppLoadingCtx {
  register: (key: string) => void
  done: (key: string) => void
}

const AppLoadingContext = createContext<AppLoadingCtx>({ register: () => {}, done: () => {} })

function FullPageSpinner() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-white dark:bg-slate-950">
      <div className="relative flex items-center justify-center">
        <div className="absolute h-20 w-20 rounded-full bg-green-500/10 animate-ping" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/logo.svg"
          alt="Schwalmtalzupfer"
          className="relative h-14 w-14 animate-spin-slow brightness-0 dark:invert"
        />
      </div>
      <div className="h-0.5 w-32 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-800">
        <div className="h-full w-full origin-left animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-green-500 to-transparent" />
      </div>
    </div>
  )
}

export function AppLoadingProvider({ children }: { children: React.ReactNode }) {
  const pendingRef = useRef<Set<string>>(new Set())
  const initialDoneRef = useRef(false)
  const [ready, setReady] = useState(false)

  const register = useCallback((key: string) => {
    // Only track during initial load
    if (!initialDoneRef.current) {
      pendingRef.current.add(key)
    }
  }, [])

  const done = useCallback((key: string) => {
    pendingRef.current.delete(key)
    if (pendingRef.current.size === 0 && !initialDoneRef.current) {
      initialDoneRef.current = true
      setReady(true)
    }
  }, [])

  return (
    <AppLoadingContext.Provider value={{ register, done }}>
      {!ready && <FullPageSpinner />}
      {children}
    </AppLoadingContext.Provider>
  )
}

export const useAppLoading = () => useContext(AppLoadingContext)

/**
 * Hook für Seiten: registriert einen Ladepunkt synchron beim Rendern
 * und gibt eine done()-Funktion zurück, die nach dem Fetch aufgerufen wird.
 */
export function usePageLoad(key: string) {
  const { register, done } = useAppLoading()
  const registeredRef = useRef(false)
  // Synchron während des Renderns registrieren – bevor Effekte laufen
  if (!registeredRef.current) {
    register(key)
    registeredRef.current = true
  }
  return useCallback(() => done(key), [done, key])
}
