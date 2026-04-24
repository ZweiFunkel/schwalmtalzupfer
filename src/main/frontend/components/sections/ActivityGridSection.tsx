'use client'

import React from 'react'
import { ActivityGridContent, ActivityItem, ActivityAccent } from '@/types/page'

const ACCENT_CONFIG: Record<ActivityAccent, {
  bg: string; border: string; iconBg: string; badge: string; heading: string; text: string
}> = {
  green:  { bg: 'bg-green-50 dark:bg-green-950/50',   border: 'border-green-200 dark:border-green-500/30',   iconBg: 'bg-green-100 dark:bg-green-900/60',   badge: 'bg-green-100 dark:bg-green-900/50 border-green-300 dark:border-green-500/40 text-green-700 dark:text-green-400',   heading: 'text-green-700 dark:text-green-300',   text: 'text-gray-600 dark:text-gray-300' },
  amber:  { bg: 'bg-amber-50 dark:bg-amber-950/50',   border: 'border-amber-200 dark:border-amber-500/30',   iconBg: 'bg-amber-100 dark:bg-amber-900/60',   badge: 'bg-amber-100 dark:bg-amber-900/50 border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-400',   heading: 'text-amber-700 dark:text-amber-300',   text: 'text-gray-600 dark:text-gray-300' },
  blue:   { bg: 'bg-blue-50 dark:bg-blue-950/50',     border: 'border-blue-200 dark:border-blue-500/30',     iconBg: 'bg-blue-100 dark:bg-blue-900/60',     badge: 'bg-blue-100 dark:bg-blue-900/50 border-blue-300 dark:border-blue-500/40 text-blue-700 dark:text-blue-400',     heading: 'text-blue-700 dark:text-blue-300',     text: 'text-gray-600 dark:text-gray-300' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/50', border: 'border-purple-200 dark:border-purple-500/30', iconBg: 'bg-purple-100 dark:bg-purple-900/60', badge: 'bg-purple-100 dark:bg-purple-900/50 border-purple-300 dark:border-purple-500/40 text-purple-700 dark:text-purple-400', heading: 'text-purple-700 dark:text-purple-300', text: 'text-gray-600 dark:text-gray-300' },
  red:    { bg: 'bg-red-50 dark:bg-red-950/50',       border: 'border-red-200 dark:border-red-500/30',       iconBg: 'bg-red-100 dark:bg-red-900/60',       badge: 'bg-red-100 dark:bg-red-900/50 border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-400',             heading: 'text-red-700 dark:text-red-300',       text: 'text-gray-600 dark:text-gray-300' },
}

function ActivityCard({ item }: { item: ActivityItem }) {
  const c = ACCENT_CONFIG[item.accent ?? 'green']
  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-6 flex flex-col gap-4`}>
      {/* Icon + Title */}
      <div className="flex items-start gap-4">
        {item.icon && (
          <div className={`flex-shrink-0 h-12 w-12 rounded-xl ${c.iconBg} flex items-center justify-center text-2xl`}>
            {item.icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className={`text-lg font-bold leading-snug ${c.heading}`}>{item.title}</h3>
          {item.targetGroup && (
            <span className={`mt-1 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${c.badge}`}>
              👥 {item.targetGroup}
            </span>
          )}
        </div>
      </div>
      {/* Text */}
      <p className={`text-sm leading-relaxed ${c.text}`}>{item.text}</p>
    </div>
  )
}

export default function ActivityGridSection({ content }: { content: ActivityGridContent }) {
  const items = content.items ?? []

  return (
    <section className="bg-white dark:bg-slate-950 py-24">
      <div className="mx-auto max-w-4xl px-6">

        {/* Header */}
        {(content.heading || content.intro) && (
          <div className="mb-12">
            {content.heading && (
              <div className="mb-4">
                <div className="mb-3 flex items-center gap-3">
                  <span className="h-0.5 w-10 bg-green-500 rounded-full" />
                  <span className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400">Vereinsleben</span>
                </div>
                <h2 className="text-4xl font-bold text-gray-900 dark:text-white">{content.heading}</h2>
              </div>
            )}
            {content.intro && (
              <p className="mt-4 text-base leading-relaxed text-gray-500 dark:text-gray-400 max-w-2xl">
                {content.intro}
              </p>
            )}
          </div>
        )}

        {/* Cards */}
        {items.length === 0 && (
          <p className="text-gray-400 italic">Keine Aktivitäten eingetragen.</p>
        )}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <ActivityCard key={i} item={item} />
          ))}
        </div>

      </div>
    </section>
  )
}
