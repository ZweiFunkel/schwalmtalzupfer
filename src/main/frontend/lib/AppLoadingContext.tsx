'use client'
import React, { createContext, useCallback, useContext, useState } from 'react'

interface AppLoadingCtx { setReady: () => void }

const AppLoadingContext = createContext<AppLoadingCtx>({ setReady: () => {} })

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
  const [ready, setReadyState] = useState(false)
  const setReady = useCallback(() => setReadyState(true), [])

  return (
    <AppLoadingContext.Provider value={{ setReady }}>
      {!ready && <FullPageSpinner />}
      {children}
    </AppLoadingContext.Provider>
  )
}

export const useAppLoading = () => useContext(AppLoadingContext)
