'use client'

import React, { useEffect, useState } from 'react'
import { useTheme } from '@/lib/ThemeProvider'

export default function ScrollButtons() {
  const [visible, setVisible] = useState(false)
  const { theme } = useTheme()

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  const bgClass = theme === 'light'
    ? 'bg-white/90 border-gray-300 text-gray-600 shadow-gray-200/60'
    : 'bg-slate-900/90 border-green-500/30 text-green-400 shadow-black/40'

  return (
    <button
      onClick={scrollTop}
      aria-label="Nach oben scrollen"
      className={`fixed bottom-7 right-7 z-50 flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-sm shadow-lg transition-all duration-300 hover:bg-green-500 hover:text-white hover:border-green-500 hover:scale-110 active:scale-95
        ${bgClass}
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  )
}

