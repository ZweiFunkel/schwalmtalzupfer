'use client'

import React from 'react'
import { QuoteContent } from '@/types/page'

export default function QuoteSection({ content }: { content: QuoteContent }) {
  const { quote, author, role } = content

  return (
    <section className="bg-white dark:bg-slate-950 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="relative text-center">
          {/* Dekoratives Anführungszeichen */}
          <span
            className="pointer-events-none select-none absolute -top-10 left-1/2 -translate-x-1/2 text-[10rem] leading-none font-serif text-green-200 dark:text-green-900"
            aria-hidden="true"
          >
            &bdquo;
          </span>

          <blockquote className="relative">
            <p className="text-2xl sm:text-3xl font-semibold italic leading-snug text-gray-800 dark:text-gray-100">
              {quote}
            </p>

            {(author || role) && (
              <footer className="mt-6 text-base text-gray-500 dark:text-gray-400">
                {author && <span className="font-bold text-gray-700 dark:text-gray-200">— {author}</span>}
                {author && role && <span>, </span>}
                {role && <span className="text-sm text-gray-400 dark:text-gray-500">{role}</span>}
              </footer>
            )}
          </blockquote>
        </div>
      </div>
    </section>
  )
}
