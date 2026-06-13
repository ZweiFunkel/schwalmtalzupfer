'use client'

import React, { useState, useEffect, useRef } from 'react'
import { SponsorGridContent, Sponsor, SponsorLocation } from '@/types/page'
import Lightbox from '@/components/Lightbox'
import { useTheme } from '@/lib/ThemeProvider'

function MapPin() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-green-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
    </svg>
  )
}

function ExternalLink({ href }: { href: string }) {
  const url = href.startsWith('http') ? href : `https://${href}`
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-green-400 hover:text-green-300 transition text-xs break-all">
      <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
      {href.replace(/^https?:\/\//, '')}
    </a>
  )
}

function LocationRow({ loc, isDarkTheme }: { loc: SponsorLocation; isDarkTheme: boolean }) {
  const rowBg  = isDarkTheme ? 'bg-slate-800/60 text-gray-300' : 'bg-gray-100 text-gray-600'
  const nameCl = isDarkTheme ? 'text-white' : 'text-gray-900'
  const phoneCl = isDarkTheme ? 'text-gray-400' : 'text-gray-500'
  return (
    <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${rowBg}`}>
      {loc.name && <p className={`font-semibold mb-0.5 ${nameCl}`}>{loc.name}</p>}
      {loc.mapUrl ? (
        <a href={loc.mapUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-green-400 transition leading-snug">
          <MapPin />{loc.address}
        </a>
      ) : (
        <p className="flex items-start gap-1 leading-snug"><MapPin />{loc.address}</p>
      )}
      {loc.phone && <p className={`mt-0.5 ${phoneCl}`}>📞 {loc.phone}</p>}
    </div>
  )
}

function SponsorImage({ src, alt, isDarkTheme, onClick }: {
  src: string; alt: string; isDarkTheme: boolean; onClick?: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // Gecachte Bilder feuern kein onLoad — direkt nach Mount prüfen
  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true)
  }, [])

  return (
    <div
      className={`relative w-full cursor-zoom-in overflow-hidden ${isDarkTheme ? 'bg-slate-900' : 'bg-gray-50'}`}
      style={{ paddingBottom: '52%' }}
      onClick={onClick}
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute inset-0 animate-pulse bg-gray-200 dark:bg-slate-800" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo.svg" alt="" className="relative h-8 w-8 animate-spin-slow brightness-0 opacity-20 dark:invert" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="eager"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`absolute inset-0 h-full w-full object-contain p-4 hover:scale-105 transition-all duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  )
}

function SponsorCardExpanded({ sponsor, onImage, isDarkTheme }: {
  sponsor: Sponsor
  onImage?: (src: string, alt: string) => void
  isDarkTheme: boolean
}) {
  const hasLocations = sponsor.locations && sponsor.locations.length > 0
  const cardBg    = isDarkTheme ? 'border-green-500/30 bg-slate-800/50' : 'border-green-400/50 bg-white shadow-lg'
  const headingCl = isDarkTheme ? 'text-white' : 'text-gray-900'
  const phoneCl   = isDarkTheme ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'
  const addrCl    = isDarkTheme ? 'text-gray-500 border-white/5' : 'text-gray-400 border-gray-200'

  return (
    <div className={`flex flex-col rounded-2xl border overflow-hidden ${cardBg} h-full`}>
      {/* Image */}
      {sponsor.imageUrl && (
        <SponsorImage
          src={sponsor.imageUrl}
          alt={sponsor.name}
          isDarkTheme={isDarkTheme}
          onClick={() => onImage?.(sponsor.imageUrl!, sponsor.name)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-2 text-left">
        <h3 className={`flex-1 text-base font-bold leading-snug ${headingCl}`}>{sponsor.name}</h3>
      </div>

       {/* Details */}
      <div className="flex flex-col gap-2 px-5 pb-5 pt-1">
         {sponsor.person && <p className="text-sm text-green-400 font-medium">{sponsor.person}</p>}
         <div className="mt-auto pt-2 flex flex-col gap-1">
          {sponsor.website && <ExternalLink href={sponsor.website} />}
          {sponsor.phone && (
            <a href={`tel:${sponsor.phone.replace(/\s/g, '')}`} className={`text-xs transition ${phoneCl}`}>
              📞 {sponsor.phone}
            </a>
          )}
          {sponsor.mobile && (
            <a href={`tel:${sponsor.mobile.replace(/\s/g, '')}`} className={`text-xs transition ${phoneCl}`}>
              📱 {sponsor.mobile}
            </a>
          )}
          {sponsor.email && (
            <a href={`mailto:${sponsor.email}`} className={`text-xs transition ${phoneCl} hover:text-green-400 break-all`}>
              ✉ {sponsor.email}
            </a>
          )}
        </div>
        {!hasLocations && sponsor.address && (
          <p className={`flex items-start gap-1 text-xs leading-snug border-t pt-2 mt-1 ${addrCl}`}>
            {sponsor.mapUrl ? (
              <a href={sponsor.mapUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-start gap-1 hover:text-green-400 transition">
                <MapPin />{sponsor.address}
              </a>
            ) : (
              <><MapPin />{sponsor.address}</>
            )}
          </p>
        )}
        {hasLocations && (
          <div className={`flex flex-col gap-1 border-t pt-2 mt-1 ${isDarkTheme ? 'border-white/5' : 'border-gray-200'}`}>
            {sponsor.locations!.map((loc, i) => <LocationRow key={i} loc={loc} isDarkTheme={isDarkTheme} />)}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SponsorGridSection({ content }: { content: SponsorGridContent }) {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const { theme } = useTheme()
  const isDarkTheme = theme === 'dark'

  // Sponsoren alphabetisch nach Namen sortieren
  const sponsors = [...(content.sponsors ?? [])].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <section className="bg-gray-50 dark:bg-slate-950 py-24">
      <div className="mx-auto max-w-7xl px-6">

        {/* Header */}
        <div className="mb-10">
          {content.heading && (
            <div className="mb-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="h-0.5 w-10 bg-green-500 rounded-full" />
                <span className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400">Unsere Sponsoren</span>
              </div>
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white">{content.heading}</h2>
            </div>
          )}
          {content.intro && (
            <p className="mt-4 text-base leading-relaxed text-gray-500 dark:text-gray-400 max-w-2xl">{content.intro}</p>
          )}
        </div>


        {/* List */}
        {sponsors.length === 0 && (
          <p className="text-gray-500 italic">Keine Sponsoren eingetragen.</p>
        )}

        <div className="columns-1 md:columns-3 gap-8 space-y-8">
          {sponsors.map((sponsor, index) => (
            <div
              key={index}
              className="break-inside-avoid opacity-0 animate-[fadeInUp_0.4s_ease-out_forwards]"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <SponsorCardExpanded
                sponsor={sponsor}
                onImage={(src, alt) => setLightbox({ src, alt })}
                isDarkTheme={isDarkTheme}
              />
            </div>
          ))}
        </div>

        {/* Danksagung */}
        <div className={`mt-16 rounded-2xl border p-8 text-center ${isDarkTheme
          ? 'border-green-500/20 bg-green-950/20'
          : 'border-green-200 bg-green-50'}`}>
          <p className={`text-lg font-semibold ${isDarkTheme ? 'text-green-300' : 'text-green-700'}`}>
            💚 Herzlichen Dank an alle unsere Sponsoren!
          </p>
          <p className={`mt-2 text-sm ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
            Durch eure Unterstützung ermöglichen wir Kindern und Jugendlichen unvergessliche Erlebnisse.
          </p>
        </div>

      </div>

      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </section>
  )
}
