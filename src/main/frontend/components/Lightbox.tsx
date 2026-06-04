'use client'

import React, { useEffect } from 'react'

interface LightboxProps {
  src: string
  alt: string
  onClose: () => void
  // Optional: Galerie-Navigation
  images?: { src: string; alt: string }[]
  index?: number
  onPrev?: () => void
  onNext?: () => void
}

export default function Lightbox({ src, alt, onClose, images, index, onPrev, onNext }: LightboxProps) {
  const hasNav = images && images.length > 1 && onPrev && onNext && index !== undefined
  const isSvg = /\.svg(\?|$)/i.test(src)
  const isFirst = index === 0
  const isLast = index !== undefined && images ? index === images.length - 1 : true

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && onPrev) onPrev()
      if (e.key === 'ArrowRight' && onNext) onNext()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose, onPrev, onNext])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/92 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition text-xl z-10"
        aria-label="Schließen"
      >
        ✕
      </button>

      {/* Counter */}
      {hasNav && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-gray-300 z-10">
          {(index as number) + 1} / {images!.length}
        </div>
      )}

      {/* Prev arrow */}
      {hasNav && (
        <button
          onClick={e => { e.stopPropagation(); onPrev!() }}
          disabled={isFirst}
          className="absolute left-4 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition disabled:opacity-20 disabled:cursor-default z-10"
          aria-label="Zurück"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Next arrow */}
      {hasNav && (
        <button
          onClick={e => { e.stopPropagation(); onNext!() }}
          disabled={isLast}
          className="absolute right-4 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition disabled:opacity-20 disabled:cursor-default z-10"
          aria-label="Weiter"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Image */}
      <div
        className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="block max-h-[90vh] max-w-[90vw] object-contain"
          style={isSvg ? { width: '70vw', height: 'auto', minWidth: '200px', minHeight: '150px' } : undefined}
        />
        {alt && (
          <p className="absolute bottom-0 left-0 right-0 bg-black/60 px-4 py-2 text-center text-sm text-gray-300 italic">
            {alt}
          </p>
        )}
      </div>

      <p className="absolute bottom-4 text-xs text-gray-500">ESC · ← →</p>
    </div>
  )
}
