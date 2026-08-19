'use client'

import React, { useState } from 'react'
import { FaqContent } from '@/types/page'

export default function FaqSection({ content }: { content: FaqContent }) {
  const items = content.items ?? []
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggle = (i: number) => {
    setOpenIndex((current) => (current === i ? null : i))
  }

  return (
    <section className="bg-white dark:bg-slate-950 py-24">
      <div className="mx-auto max-w-3xl px-6">

        {/* Header */}
        {content.heading && (
          <div className="mb-12">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-0.5 w-10 bg-green-500 rounded-full" />
              <span className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400">FAQ</span>
            </div>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white">{content.heading}</h2>
          </div>
        )}

        {/* Accordion */}
        {items.length === 0 && (
          <p className="text-gray-400 italic">Keine Fragen eingetragen.</p>
        )}
        <div className="flex flex-col gap-3">
          {items.map((item, i) => {
            const isOpen = openIndex === i
            return (
              <div
                key={i}
                className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <span className="text-base font-semibold text-gray-900 dark:text-white">
                    {item.question}
                  </span>
                  <span
                    className={`flex-shrink-0 text-green-600 dark:text-green-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : 'rotate-0'}`}
                  >
                    ▸
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-4">
                    <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-line">
                      {item.answer}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </section>
  )
}
