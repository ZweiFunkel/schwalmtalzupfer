'use client'

import React from 'react'
import Link from 'next/link'
import { CtaButtonContent } from '@/types/page'

export default function CtaButtonSection({ content }: { content: CtaButtonContent }) {
  const isExternal = /^https?:\/\//i.test(content.buttonHref)

  const buttonClassName =
    'group inline-flex items-center gap-2 rounded-2xl bg-green-500 px-10 py-4 text-lg font-semibold text-white shadow-2xl shadow-green-500/40 transition hover:bg-green-400 hover:shadow-green-400/50 hover:scale-105 active:scale-100'

  const buttonInner = (
    <>
      {content.buttonLabel}
      <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </>
  )

  return (
    <section className="bg-white dark:bg-slate-950 py-24">
      <div className="mx-auto max-w-4xl px-6 text-center">

        {/* Header */}
        {content.heading && (
          <div className="mb-4">
            <div className="mb-3 flex items-center justify-center gap-3">
              <span className="h-0.5 w-10 bg-green-500 rounded-full" />
              <span className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400">Jetzt aktiv werden</span>
            </div>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white">{content.heading}</h2>
          </div>
        )}

        {/* Text */}
        {content.text && (
          <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-gray-500 dark:text-gray-400">
            {content.text}
          </p>
        )}

        {/* Button */}
        <div className={content.heading || content.text ? '' : 'mt-0'}>
          {isExternal ? (
            <a href={content.buttonHref} target="_blank" rel="noopener noreferrer" className={buttonClassName}>
              {buttonInner}
            </a>
          ) : (
            <Link href={content.buttonHref} className={buttonClassName}>
              {buttonInner}
            </Link>
          )}
        </div>

      </div>
    </section>
  )
}
