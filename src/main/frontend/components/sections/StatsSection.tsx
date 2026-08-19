'use client'

import React from 'react'
import { StatsContent } from '@/types/page'

function gridColsClass(count: number): string {
  if (count >= 4) return 'sm:grid-cols-2 lg:grid-cols-4'
  if (count === 3) return 'sm:grid-cols-3'
  if (count === 2) return 'sm:grid-cols-2'
  return 'sm:grid-cols-1'
}

export default function StatsSection({ content }: { content: StatsContent }) {
  const items = content.items ?? []

  return (
    <section className="bg-white dark:bg-slate-950 py-24">
      <div className="mx-auto max-w-4xl px-6">

        {/* Header */}
        {content.heading && (
          <div className="mb-12">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-0.5 w-10 bg-green-500 rounded-full" />
              <span className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400">Zahlen &amp; Fakten</span>
            </div>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white">{content.heading}</h2>
          </div>
        )}

        {/* Stats grid */}
        {items.length === 0 && (
          <p className="text-gray-400 italic">Keine Statistiken eingetragen.</p>
        )}
        <div className={`grid grid-cols-2 gap-8 ${gridColsClass(items.length)}`}>
          {items.map((item, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-2">
              <span className="text-4xl sm:text-5xl font-bold text-green-600 dark:text-green-400">
                {item.value}
              </span>
              <span className="text-sm sm:text-base font-medium text-gray-500 dark:text-gray-400">
                {item.label}
              </span>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
