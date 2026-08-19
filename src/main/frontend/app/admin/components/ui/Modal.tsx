'use client'
import React, { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxWidthClassName?: string
}

/** Generischer Modal-Wrapper - ersetzt die bisher fünf eigenständigen, fast identischen
 *  Overlay-Implementierungen im Admin-Bereich. */
export function Modal({ open, onClose, title, children, maxWidthClassName = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidthClassName} rounded-xl border border-white/10 bg-slate-900 shadow-2xl`}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="border-b border-white/10 px-5 py-3.5">
            <h3 className="font-semibold text-white">{title}</h3>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
