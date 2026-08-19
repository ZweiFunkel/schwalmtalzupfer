'use client'
import React, { createContext, useCallback, useContext, useRef, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'
interface ToastItem { id: number; message: string; type: ToastType }

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} })

/** Zeigt eine kurzlebige Erfolgs-/Fehler-/Info-Meldung an - ersetzt die bisher verstreuten
 *  lokalen "xMsg"-States mit manuellem setTimeout-Clear. */
export const useToast = () => useContext(ToastContext)

const TYPE_CLASSES: Record<ToastType, string> = {
  success: 'bg-green-900/90 border-green-500/30 text-green-300',
  error: 'bg-red-900/90 border-red-500/30 text-red-300',
  info: 'bg-slate-800/95 border-white/10 text-gray-200',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId.current++
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`rounded-lg border px-4 py-2.5 text-sm shadow-lg ${TYPE_CLASSES[t.type]}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
