'use client'

import React, { useEffect, useState } from 'react'

interface AnchorItem {
  id: string
  label: string
}

export default function PageAnchorNav({ anchors }: { anchors: AnchorItem[] }) {
  const [active, setActive] = useState(anchors[0]?.id ?? '')

  useEffect(() => {
    const handler = () => {
      for (let i = anchors.length - 1; i >= 0; i--) {
        const el = document.getElementById(anchors[i].id)
        if (el && el.getBoundingClientRect().top <= 120) {
          setActive(anchors[i].id)
          return
        }
      }
      setActive(anchors[0]?.id ?? '')
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [anchors])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      const offset = 80
      const top = el.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  return (
    <div className="sticky top-[60px] z-40 border-b border-gray-200 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl gap-1 px-6 py-2">
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
    </div>
  )
}

