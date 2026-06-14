'use client'
import { getApiBase } from '@/lib/api'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Lightbox from '@/components/Lightbox'

const API_BASE = getApiBase()

// ─── Label-Mapping ───────────────────────────────────────────────────────────
const LABELS: Record<string, string> = {
  galerie:                    'Galerie',
  ausfluege:                  'Ausflüge',
  sonstiges:                  'Sonstiges',
  sommerkonzerte:             'Sommerkonzerte',
  winterkonzerte:             'Winterkonzerte',
  allgaeu:                    'Allgäu',
  frankreich:                 'Frankreich',
  kaerkestour:                'Kärkestour',
  ponyhof:                    'Ponyhof',
  'cd-aufnahme':              'CD Aufnahme',
  'weihnachtsmarkt-waldniel': 'Weihnachtsmarkt Waldniel',
}
const label = (s: string) =>
  LABELS[s.toLowerCase()] ?? s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')

// ─── Smart Title ─────────────────────────────────────────────────────────────
/**
 * Leitet einen menschenlesbaren Titel aus dem Pfad ab.
 * Beispiele (Teile nach "galerie"):
 *   ['sommerkonzerte']          → "Sommerkonzerte"
 *   ['sommerkonzerte', '2012']  → "Sommerkonzerte 2012"
 *   ['ausfluege', 'frankreich'] → "Frankreich"
 *   ['ausfluege', 'frankreich', '2022'] → "Frankreich 2022"
 */
function buildTitle(parts: string[]): string {
  const relevant = parts.slice(1) // 'galerie' überspringen
  if (relevant.length === 0) return 'Galerie'
  const last = relevant[relevant.length - 1]
  const isYear = /^\d{4}$/.test(last)
  if (isYear && relevant.length >= 2) {
    return `${label(relevant[relevant.length - 2])} ${last}`
  }
  return label(last)
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface BrowseFolder { name: string; prefix: string; coverUrl: string; imageCount: number; hasSubFolders: boolean }
interface BrowseImage  { key: string; url: string; name: string }
interface BrowseResult { prefix: string; folders: BrowseFolder[]; images: BrowseImage[] }

// ─── Breadcrumb ──────────────────────────────────────────────────────────────
function Breadcrumb({ prefix }: { prefix: string }) {
  // prefix = 'galerie/sommerkonzerte/2023/' → parts = ['galerie','sommerkonzerte','2023']
  const parts = prefix.replace(/\/$/, '').split('/').filter(Boolean)
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
      {parts.map((part, i) => {
        const isLast = i === parts.length - 1
        // '/galerie', '/galerie/sommerkonzerte', …
        const href = '/' + parts.slice(0, i + 1).join('/')
        return (
          <React.Fragment key={i}>
            {i > 0 && <span className="opacity-40">/</span>}
            {isLast ? (
              <span className="font-semibold text-gray-900 dark:text-white">{label(part)}</span>
            ) : (
              <Link href={href} className="hover:text-green-600 dark:hover:text-green-400 transition">
                {label(part)}
              </Link>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="aspect-[3/2] animate-pulse rounded-2xl bg-gray-200 dark:bg-slate-800" />
      ))}
    </div>
  )
}

// ─── Folder Card ─────────────────────────────────────────────────────────────
function FolderCard({ folder }: { folder: BrowseFolder }) {
  // 'galerie/sommerkonzerte/' → '/galerie/sommerkonzerte'
  const href = '/' + folder.prefix.replace(/\/$/, '')
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl bg-gray-100 dark:bg-slate-800 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 focus:outline-none focus:ring-2 focus:ring-green-500"
    >
      <div className="aspect-[4/3] overflow-hidden">
        {folder.coverUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={folder.coverUrl} alt="" loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          : <div className="flex h-full w-full items-center justify-center text-5xl opacity-20">🖼️</div>
        }
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-base font-bold text-white leading-tight">{label(folder.name)}</p>
        <p className="mt-0.5 text-xs text-white/60">
          {folder.imageCount > 0
            ? `${folder.imageCount} Foto${folder.imageCount !== 1 ? 's' : ''}`
            : folder.hasSubFolders ? 'Unteralben' : 'Leer'}
        </p>
      </div>
      <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}

// ─── Photo Grid ──────────────────────────────────────────────────────────────
function thumbUrl(key: string) {
  return `${API_BASE}/api/galerie/thumbnail?key=${encodeURIComponent(key)}`
}

// Einzelnes Foto-Tile: lädt erst wenn es (fast) im Viewport ist,
// zeigt Skeleton solange und blendet das Bild beim Laden ein.
function PhotoThumb({ img, eager, onLoaded, onClick }: {
  img: BrowseImage
  eager: boolean
  onLoaded?: () => void
  onClick: () => void
}) {
  const [src, setSrc]     = useState<string | null>(eager ? thumbUrl(img.key) : null)
  const [loaded, setLoaded] = useState(false)
  const containerRef = useRef<HTMLButtonElement>(null)
  const reportedRef  = useRef(false)

  const markLoaded = useCallback(() => {
    setLoaded(true)
    if (!reportedRef.current) {
      reportedRef.current = true
      onLoaded?.()
    }
  }, [onLoaded])

  // Gecachtes Bild feuert kein onLoad
  const imgRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    if (imgRef.current?.complete) markLoaded()
  }, [src, markLoaded])

  // IntersectionObserver lädt das Bild, sobald es 200 px vor dem Viewport ist
  useEffect(() => {
    if (eager) return
    const el = containerRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setSrc(thumbUrl(img.key))
        obs.disconnect()
      }
    }, { rootMargin: '300px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [eager, img.key])

  return (
    <button
      ref={containerRef}
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-xl bg-gray-100 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
      aria-label="Foto öffnen"
    >
      {/* Skeleton — verschwindet wenn Bild geladen */}
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-gray-200 dark:bg-slate-700" />
      )}

      {/* Bild — wird eingeblendet sobald geladen */}
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={src}
          alt=""
          decoding="async"
          onLoad={markLoaded}
          onError={markLoaded}
          className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Hover-Overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center pointer-events-none">
        <svg className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition drop-shadow-lg"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
      </div>
    </button>
  )
}

// Wie viele Bilder sind "above the fold"? (ca. 2 Reihen × 5 Spalten)
const ABOVE_FOLD = 10

function PhotoGrid({ images }: { images: BrowseImage[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [gridVisible, setGridVisible]     = useState(false)

  const lbImages = images.map(img => ({ src: img.url, alt: '' }))
  const close = useCallback(() => setLightboxIndex(null), [])
  const prev  = useCallback(() => setLightboxIndex(i => (i !== null && i > 0 ? i - 1 : i)), [])
  const next  = useCallback(() => setLightboxIndex(i => (i !== null && i < images.length - 1 ? i + 1 : i)), [images.length])

  // Zählt wie viele der ersten ABOVE_FOLD Bilder fertig sind
  const aboveFoldTarget = Math.min(images.length, ABOVE_FOLD)
  const loadedRef = useRef(0)
  const handleAboveFoldLoad = useCallback(() => {
    loadedRef.current += 1
    if (loadedRef.current >= aboveFoldTarget) setGridVisible(true)
  }, [aboveFoldTarget])

  // Wenn keine Bilder: sofort sichtbar
  useEffect(() => {
    if (images.length === 0) setGridVisible(true)
  }, [images.length])

  return (
    <>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        {images.length} Foto{images.length !== 1 ? 's' : ''} &nbsp;·&nbsp; Klicken zum Öffnen &nbsp;·&nbsp; ← → zum Navigieren
      </p>

      {/* Skeleton-Platzhalter solange die ersten Bilder noch laden */}
      {!gridVisible && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[...Array(aboveFoldTarget)].map((_, i) => (
            <div key={i} className="aspect-square rounded-xl animate-pulse bg-gray-200 dark:bg-slate-700" />
          ))}
        </div>
      )}

      {/* Echtes Grid — eingeblendet sobald above-fold Bilder bereit sind */}
      <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 transition-opacity duration-500 ${
        gridVisible ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
      }`}>
        {images.map((img, i) => (
          <PhotoThumb
            key={img.key}
            img={img}
            eager={i < ABOVE_FOLD}
            onLoaded={i < ABOVE_FOLD ? handleAboveFoldLoad : undefined}
            onClick={() => setLightboxIndex(i)}
          />
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          src={lbImages[lightboxIndex].src}
          alt={lbImages[lightboxIndex].alt}
          onClose={close}
          images={lbImages}
          index={lightboxIndex}
          onPrev={prev}
          onNext={next}
        />
      )}
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
  /** R2-Prefix des aktuellen Ordners, z.B. 'galerie/sommerkonzerte/2023/'
   *  Wenn nicht angegeben, wird der Pfad aus der URL abgeleitet (usePathname). */
  prefix?: string
}

export default function GalerieModernView({ prefix: prefixProp }: Props) {
  const pathname = usePathname()

  // Prefix aus Prop oder aus der aktuellen URL ableiten
  const currentPrefix = useMemo(() => {
    if (prefixProp) return prefixProp.endsWith('/') ? prefixProp : prefixProp + '/'
    // pathname = '/galerie' oder '/galerie/sommerkonzerte/2023'
    const raw = (pathname ?? '/galerie').replace(/^\//, '')
    return raw.endsWith('/') ? raw : raw + '/'
  }, [prefixProp, pathname])

  const [data, setData]   = useState<BrowseResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState(false)
  const isRoot = currentPrefix === 'galerie/'
  const parts  = currentPrefix.replace(/\/$/, '').split('/').filter(Boolean)

  // Seitentitel
  useEffect(() => {
    const title = currentPrefix === 'galerie/' ? 'Galerie' : buildTitle(
      currentPrefix.replace(/\/$/, '').split('/').filter(Boolean)
    )
    document.title = `${title} – Schwalmtalzupfer`
  }, [currentPrefix])

  useEffect(() => {
    setLoading(true)
    setData(null)
    setApiError(false)
    fetch(`${API_BASE}/api/galerie/browse?prefix=${encodeURIComponent(currentPrefix)}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Galerie API error:', err)
        setApiError(true)
        setLoading(false)
      })
  }, [currentPrefix])

  const hasContent = data && (data.folders.length > 0 || data.images.length > 0)

  return (
    <div className="relative mx-auto max-w-7xl px-6 py-12 sm:px-8">

      {/* Lade-Overlay beim Wechsel zwischen Ordnern */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo.svg" alt="" className="h-10 w-10 animate-spin-slow brightness-0 dark:invert" />
            <div className="h-0.5 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
              <div className="h-full w-full origin-left animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-green-500 to-transparent" />
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb (nur wenn tiefer als Startebene) */}
      {!isRoot && <Breadcrumb prefix={currentPrefix} />}

      {/* Überschrift */}
      {isRoot ? (
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">Galerie</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Fotos aus Konzerten, Ausflügen und Vereinsleben
          </p>
        </div>
      ) : (
        <h2 className="mb-8 text-2xl font-extrabold text-gray-900 dark:text-white sm:text-3xl">
          {buildTitle(parts)}
        </h2>
      )}

      {/* Skeleton beim ersten Laden */}
      {loading && !data && <CardSkeleton count={isRoot ? 4 : 6} />}

      {/* Inhalt */}
      {!loading && data && (
        <>
          {data.folders.length > 0 && (
            <div className={`grid gap-6 ${
              isRoot
                ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3'
            }`}>
              {data.folders.map(folder => (
                <FolderCard key={folder.prefix} folder={folder} />
              ))}
            </div>
          )}

          {data.images.length > 0 && (
            <div className={data.folders.length > 0 ? 'mt-10' : ''}>
              <PhotoGrid images={data.images} />
            </div>
          )}

          {!hasContent && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-4 text-6xl opacity-20">📂</div>
              <p className="text-gray-500 dark:text-gray-400">Noch keine Inhalte in diesem Bereich.</p>
            </div>
          )}
        </>
      )}

      {/* API-Fehler */}
      {!loading && apiError && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 text-6xl opacity-20">⚠️</div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Galerie konnte nicht geladen werden.</p>
          <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
            Möglicherweise ist die R2-Speicher-Verbindung nicht konfiguriert.
          </p>
          <button
            onClick={() => { setApiError(false); setLoading(true); fetch(`${API_BASE}/api/galerie/browse?prefix=${encodeURIComponent(currentPrefix)}`).then(r => r.ok ? r.json() : Promise.reject()).then(d => { setData(d); setLoading(false) }).catch(() => { setApiError(true); setLoading(false) }) }}
            className="mt-4 rounded-lg border border-gray-300 dark:border-white/20 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:border-green-500/50 hover:text-green-600 dark:hover:text-green-400 transition"
          >
            Erneut versuchen
          </button>
        </div>
      )}
    </div>
  )
}
