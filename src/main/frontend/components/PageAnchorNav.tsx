'use client'

import React, { useEffect, useRef, useState } from 'react'

interface AnchorItem {
  id: string
  label: string
}

export default function PageAnchorNav({ anchors }: { anchors: AnchorItem[] }) {
  const [active, setActive] = useState(anchors[0]?.id ?? '')
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = () => {
      const threshold = window.innerHeight * 0.4
      for (let i = anchors.length - 1; i >= 0; i--) {
        const el = document.getElementById(anchors[i].id)
        if (el && el.getBoundingClientRect().top <= threshold) {
          setActive(anchors[i].id)
          return
        }
      }
      setActive(anchors[0]?.id ?? '')
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [anchors])

  // Dropdown schließen bei Klick außerhalb
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const scrollTo = (id: string) => {
    setOpen(false)
    const el = document.getElementById(id)
    if (el) {
      const offset = 124
      const top = el.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }
  }

  const activeLabel = anchors.find(a => a.id === active)?.label ?? anchors[0]?.label ?? ''

  return (
    <div className="sticky top-20 z-40 border-b border-gray-200 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">

      {/* Desktop: horizontale Tabs */}
      <div className="hidden sm:flex mx-auto max-w-3xl gap-1 px-6 py-2">
        {anchors.map(a => (
          <button
            key={a.id}
            onClick={() => scrollTo(a.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              active === a.id
                ? 'bg-green-600 text-white shadow-lg shadow-green-900/30'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Mobile: einklappbares Dropdown */}
      <div className="sm:hidden relative px-4 py-2" ref={dropdownRef}>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex w-full items-center justify-between rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-white shadow-sm"
        >
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            {activeLabel}
          </span>
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-4 right-4 top-full mt-1 z-50 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
            {anchors.map((a, i) => (
              <button
                key={a.id}
                onClick={() => scrollTo(a.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-medium transition ${
                  i < anchors.length - 1 ? 'border-b border-gray-100 dark:border-white/5' : ''
                } ${
                  active === a.id
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${active === a.id ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-600'}`} />
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
