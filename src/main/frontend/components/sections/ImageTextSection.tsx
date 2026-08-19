'use client'

import React from 'react'
import { ImageTextContent } from '@/types/page'
import ReactMarkdown from 'react-markdown'

export default function ImageTextSection({ content }: { content: ImageTextContent }) {
  const imagePosition = content.imagePosition ?? 'left'
  const imageOrderClass = imagePosition === 'right' ? 'md:order-2' : 'md:order-1'
  const textOrderClass = imagePosition === 'right' ? 'md:order-1' : 'md:order-2'

  return (
    <section className="bg-white dark:bg-slate-950 py-24">
      <div className="mx-auto max-w-4xl px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-center">
          {/* Bild */}
          <div className={imageOrderClass}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.imageUrl}
              alt={content.heading ?? ''}
              className="w-full object-cover rounded-2xl ring-1 ring-gray-200 dark:ring-white/10 max-h-[480px]"
            />
          </div>

          {/* Text */}
          <div className={textOrderClass}>
            {content.heading && (
              <div className="mb-6">
                <div className="mb-3 flex items-center gap-3">
                  <span className="h-0.5 w-10 bg-green-500 rounded-full" />
                </div>
                <h2 className="text-4xl font-bold text-gray-900 dark:text-white">{content.heading}</h2>
              </div>
            )}
            <article className="prose prose-lg prose-green dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 [&_p]:leading-relaxed [&_p]:mb-5">
              <ReactMarkdown>{content.markdown}</ReactMarkdown>
            </article>
          </div>
        </div>
      </div>
    </section>
  )
}
