'use client'
import React, { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react'

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
  const doneRef = useRef(false)
  const [ready, setReady] = useState(false)

  const register = useCallback((key: string) => {
    if (!doneRef.current) {
      pendingRef.current.add(key)
    }
  }, [])

  const done = useCallback((key: string) => {
    pendingRef.current.delete(key)
    // requestAnimationFrame gives Suspense-deferred page components one
    // render cycle to call register() before we decide we're finished
    requestAnimationFrame(() => {
      if (pendingRef.current.size === 0 && !doneRef.current) {
        doneRef.current = true
        setReady(true)
      }
    })
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
 * Registriert einen Lade-Slot via useLayoutEffect (läuft vor useEffect-Fetches),
 * gibt eine done()-Funktion zurück, die nach dem Fetch aufgerufen wird.
 */
export function usePageLoad(key: string) {
  const { register, done } = useAppLoading()

  // useLayoutEffect läuft synchron nach DOM-Commit, BEVOR irgendein useEffect-Fetch startet.
  // So ist der Key garantiert im Set bevor done() aufgerufen werden kann.
  useLayoutEffect(() => {
    register(key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return useCallback(() => done(key), [done, key])
}
