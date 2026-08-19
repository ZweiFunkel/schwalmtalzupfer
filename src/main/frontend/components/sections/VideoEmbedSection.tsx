'use client'

import React from 'react'
import { VideoEmbedContent } from '@/types/page'

function getEmbedUrl(videoUrl: string): string | null {
  if (!videoUrl) return null

  try {
    const url = new URL(videoUrl.trim())
    const host = url.hostname.replace(/^www\./, '')

    // Bereits fertige Embed-URL
    if (host === 'youtube.com' && url.pathname.startsWith('/embed/')) {
      return url.toString()
    }

    // https://www.youtube.com/watch?v=VIDEO_ID (auch mit &list=...)
    if (host === 'youtube.com' && url.pathname === '/watch') {
      const videoId = url.searchParams.get('v')
      if (videoId) return `https://www.youtube.com/embed/${videoId}`
    }

    // https://youtu.be/VIDEO_ID
    if (host === 'youtu.be') {
      const videoId = url.pathname.replace(/^\//, '').split('/')[0]
      if (videoId) return `https://www.youtube.com/embed/${videoId}`
    }

    // https://vimeo.com/VIDEO_ID
    if (host === 'vimeo.com') {
      const match = url.pathname.match(/^\/(\d+)/)
      if (match) return `https://player.vimeo.com/video/${match[1]}`
    }

    return null
  } catch {
    return null
  }
}

export default function VideoEmbedSection({ content }: { content: VideoEmbedContent }) {
  const embedUrl = getEmbedUrl(content.videoUrl)

  return (
    <section className="bg-white dark:bg-slate-950 py-24">
      <div className="mx-auto max-w-4xl px-6">

        {/* Header */}
        {content.heading && (
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-0.5 w-10 bg-green-500 rounded-full" />
              <span className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400">Video</span>
            </div>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white">{content.heading}</h2>
          </div>
        )}

        {/* Video */}
        {embedUrl ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-gray-100 dark:bg-slate-900">
            <iframe
              src={embedUrl}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              title={content.heading || 'Video'}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-8 text-center">
            <a
              href={content.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-base font-semibold text-green-600 dark:text-green-400 hover:underline"
            >
              Video ansehen ↗
            </a>
          </div>
        )}

        {/* Caption */}
        {content.caption && (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{content.caption}</p>
        )}

      </div>
    </section>
  )
}
