'use client'

import React, { useEffect } from 'react'

interface LightboxProps {
  src: string
  alt: string
  onClose: () => void
}

export default function Lightbox({ src, alt, onClose }: LightboxProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 cursor-zoom-out"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition text-xl"
        aria-label="Schließen"
      >
        ✕
      </button>

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
        />
        {alt && (
          <p className="absolute bottom-0 left-0 right-0 bg-black/60 px-4 py-2 text-center text-sm text-gray-300 italic">
            {alt}
          </p>
        )}
      </div>

      <p className="absolute bottom-4 text-xs text-gray-500">ESC oder klicken zum Schließen</p>
    </div>
  )
}

