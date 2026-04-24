'use client'

import React, { useState } from 'react'
import { ImageCaptionContent } from '@/types/page'
import Lightbox from '@/components/Lightbox'

export default function ImageCaptionSection({ content }: { content: ImageCaptionContent }) {
  const [open, setOpen] = useState(false)

  return (
    <section className="bg-gray-50 dark:bg-slate-900 py-16">
      <div className="mx-auto max-w-4xl px-6">
        <figure className="overflow-hidden rounded-2xl ring-1 ring-gray-200 dark:ring-white/10 cursor-zoom-in group" onClick={() => setOpen(true)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={content.imageUrl}
            alt={content.altText ?? content.caption ?? ''}
            className="w-full object-cover max-h-[520px] transition group-hover:brightness-90"
          />
          {content.caption && (
            <figcaption className="bg-gray-100 dark:bg-slate-800/80 px-6 py-3 text-center text-sm text-gray-500 dark:text-gray-400 italic">
              {content.caption}
            </figcaption>
          )}
        </figure>
      </div>

      {open && (
        <Lightbox
          src={content.imageUrl}
          alt={content.altText ?? content.caption ?? ''}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  )
}
