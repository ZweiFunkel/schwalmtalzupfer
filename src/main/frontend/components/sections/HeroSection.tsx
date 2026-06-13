'use client'

import React, { useEffect, useRef } from 'react'
import { HeroContent } from '@/types/page'

export default function HeroSection({ content }: { content: HeroContent }) {
  const bgRef = useRef<HTMLDivElement>(null)

  // Parallax-Effekt: Hintergrundbild bewegt sich langsamer als der Scroll
  useEffect(() => {
    if (!content.backgroundImage) return
    const handleScroll = () => {
      if (bgRef.current) {
        const offset = window.scrollY * 0.4
        bgRef.current.style.transform = `translateY(${offset}px) scale(1.1)`
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [content.backgroundImage])

  return (
    <section className="hero-section relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-950 text-white">

      {/* Parallax-Hintergrundbild */}
      {content.backgroundImage && (
        <div ref={bgRef} className="absolute inset-0"
          style={{
            backgroundImage: `url(${content.backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: 'scale(1.1)',
            willChange: 'transform',
          }}
        />
      )}

      {/* Konfigurierbares Overlay für Lesbarkeit – overlayOpacity 0–1, Standard 0.55 */}
      <div className="absolute inset-0 bg-black" style={{ opacity: content.overlayOpacity ?? 0.55 }} />
      {/* Farbiger Hauch unten für Übergang zur nächsten Sektion */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />

      {/* Dezente Textur */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      {/* Inhalt */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">


        {/* Hauptüberschrift */}
        <h1 className="animate-slide-up mb-5 text-5xl font-extrabold leading-tight tracking-tight md:text-7xl"
          style={{ textShadow: '0 2px 20px rgba(0,0,0,0.8), 0 0 60px rgba(0,0,0,0.5)' }}>
          {content.headline}
        </h1>

        {/* Akzentlinie */}
        <div className="animate-slide-up mx-auto mb-6 h-1 w-20 rounded-full bg-gradient-to-r from-green-500 to-emerald-400 opacity-80" />

        {/* Unterüberschrift */}
        {content.subheadline && (
          <p className="animate-slide-up-delay mb-10 text-xl text-gray-200 md:text-2xl"
            style={{ textShadow: '0 1px 12px rgba(0,0,0,0.9)' }}>
            {content.subheadline}
          </p>
        )}

        {/* CTA-Button */}
        {content.ctaLabel && content.ctaHref && (
          <div className="animate-slide-up-delay-2 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a href={content.ctaHref}
              className="group inline-flex items-center gap-2 rounded-2xl bg-green-500 px-10 py-4 text-lg font-semibold text-white shadow-2xl shadow-green-500/40 transition hover:bg-green-400 hover:shadow-green-400/50 hover:scale-105 active:scale-100">
              {content.ctaLabel}
              <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          </div>
        )}
      </div>

      {/* Scroll-Down-Indikator / Button */}
      <div className="absolute bottom-16 left-1/2 z-20 -translate-x-1/2 flex flex-col items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-gray-400 opacity-60">Scroll</span>
        <button
          aria-label="Nach unten scrollen"
          onClick={() => {
            const next = document.querySelector('main > *:nth-child(2)') as HTMLElement
            if (next) next.scrollIntoView({ behavior: 'smooth' })
            else window.scrollBy({ top: window.innerHeight, behavior: 'smooth' })
          }}
          className="group flex h-10 w-6 items-start justify-center rounded-full border border-gray-500/50 pt-2 transition hover:border-green-500/70"
        >
          <div className="h-2 w-1 rounded-full bg-gray-400 animate-bounce group-hover:bg-green-400 transition" />
        </button>
      </div>

      {/* Wellen-Übergang nach unten */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10">
        <svg viewBox="0 0 1440 100" className="block w-full fill-slate-950" preserveAspectRatio="none">
          <path d="M0,60 C240,100 480,20 720,60 C960,100 1200,20 1440,60 L1440,100 L0,100 Z" />
        </svg>
      </div>
    </section>
  )
}


