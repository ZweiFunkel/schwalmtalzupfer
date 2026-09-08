'use client'

import React from 'react'
import { TextBlockContent } from '@/types/page'
import ReactMarkdown from 'react-markdown'
import { useTheme } from '@/lib/ThemeProvider'

interface Props {
  content: TextBlockContent
  index?: number
  anchorId?: string
}

export default function TextBlockSection({ content, index = 0, anchorId }: Props) {
  const { theme } = useTheme()
  const isDark = index % 2 === 1

  if (isDark) {
    return (
      <section id={anchorId} className="bg-gray-100 dark:bg-slate-950 py-24 scroll-mt-28">
        <div className="mx-auto max-w-3xl px-6">
          {content.heading && (
            <div className="mb-10">
              <div className="mb-3 flex items-center gap-3">
                <span className="h-0.5 w-10 bg-green-500 rounded-full" />
                <span className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400">Leitfaden</span>
              </div>
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white">{content.heading}</h2>
            </div>
          )}
          <article className="prose prose-lg prose-green dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 [&_p]:leading-relaxed [&_p]:mb-5">
            <ReactMarkdown>{content.markdown}</ReactMarkdown>
          </article>
        </div>
      </section>
    )
  }

  // Even sections: light uses bg-white, dark mode uses bg-slate-900
  const bgClass = theme === 'dark' ? 'bg-slate-900' : 'bg-white'
  const headingClass = theme === 'dark' ? 'text-white' : 'text-gray-900'
  const labelClass = theme === 'dark' ? 'text-green-400' : 'text-green-600'
  const proseClass = theme === 'dark'
    ? 'prose prose-lg prose-invert prose-green max-w-none text-gray-300 [&_p]:leading-relaxed [&_p]:mb-5'
    : 'prose prose-lg prose-green max-w-none text-gray-700 [&_p]:leading-relaxed [&_p]:mb-5'

  return (
    <section id={anchorId} className={`${bgClass} py-24 scroll-mt-28`}>
      <div className="mx-auto max-w-3xl px-6">
        {content.heading && (
          <div className="mb-10">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-0.5 w-10 bg-green-500 rounded-full" />
              <span className={`text-xs font-bold uppercase tracking-widest ${labelClass}`}>Geschichte</span>
            </div>
            <h2 className={`text-4xl font-bold ${headingClass}`}>{content.heading}</h2>
          </div>
        )}
        <article className={proseClass}>
          <ReactMarkdown>{content.markdown}</ReactMarkdown>
        </article>
      </div>
    </section>
  )
}
