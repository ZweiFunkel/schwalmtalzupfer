'use client'
import { getApiBase } from '@/lib/api'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Lightbox from '@/components/Lightbox'
import { useTheme } from '@/lib/ThemeProvider'

const API_BASE = getApiBase()

// ─── Label-Mapping ─────────────────────────────────────────────────────────────
const FOLDER_LABELS: Record<string, string> = {
  galerie:                   'Galerie',
  ausfluege:                 'Ausflüge',
  sonstiges:                 'Sonstiges',
  sommerkonzerte:            'Sommerkonzerte',
  winterkonzerte:            'Winterkonzerte',
  allgaeu:                   'Allgäu',
  frankreich:                'Frankreich',
  kaerkestour:               'Kärkestour',
  ponyhof:                   'Ponyhof',
  'cd-aufnahme':             'CD Aufnahme',
  'weihnachtsmarkt-waldniel': 'Weihnachtsmarkt Waldniel',
}

function labelFor(name: string): string {
  return FOLDER_LABELS[name.toLowerCase()] ?? name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ')
}

// ─── Types ──────────────────────────────────────────────────────────────────────
interface GalerieFolder {
  name: string
  prefix: string
  coverUrl: string
  imageCount: number
  hasSubFolders: boolean
}

interface GalerieImage {
  key: string
  url: string
  name: string
}

interface BrowseResult {
  prefix: string
  folders: GalerieFolder[]
  images: GalerieImage[]
}

// ─── Breadcrumb ─────────────────────────────────────────────────────────────────
function Breadcrumb({ prefix }: { prefix: string }) {
  const parts = prefix.replace(/\/$/, '').split('/').filter(Boolean)
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
      {parts.map((part, i) => {
        const href = i === 0 ? '/galerie' : '/galerie/' + parts.slice(1, i + 1).join('/')
        const isLast = i === parts.length - 1
        return (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-gray-300 dark:text-gray-600">/</span>}
            {isLast ? (
              <span className="font-semibold text-gray-900 dark:text-white">{labelFor(part)}</span>
            ) : (
              <Link href={href} className="hover:text-green-600 dark:hover:text-green-400 transition">
                {labelFor(part)}
              </Link>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

// ─── Folder Card ────────────────────────────────────────────────────────────────
function FolderCard({ folder, href }: { folder: GalerieFolder; href: string }) {
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-2xl bg-gray-100 dark:bg-slate-800 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
    >
      {/* Cover image */}
      <div className="aspect-[4/3] overflow-hidden bg-gray-200 dark:bg-slate-700">
        {folder.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={folder.coverUrl}
            alt={labelFor(folder.name)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl opacity-20">🖼️</div>
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />

      {/* Title + count */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-lg font-bold text-white drop-shadow">{labelFor(folder.name)}</p>
        <p className="mt-0.5 text-xs text-white/70">
          {folder.hasSubFolders
            ? folder.imageCount > 0 ? `${folder.imageCount} Fotos` : 'Unteralben'
            : `${folder.imageCount} Foto${folder.imageCount !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Arrow badge */}
      <div className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}

// ─── Photo Grid ────────────────────────────────────────────────────────────────
function PhotoGrid({ images }: { images: GalerieImage[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const lightboxImages = images.map(img => ({ src: img.url, alt: img.name }))

  const open = useCallback((i: number) => setLightboxIndex(i), [])
  const close = useCallback(() => setLightboxIndex(null), [])
  const prev = useCallback(() => setLightboxIndex(i => (i !== null && i > 0 ? i - 1 : i)), [])
  const next = useCallback(
    () => setLightboxIndex(i => (i !== null && i < images.length - 1 ? i + 1 : i)),
    [images.length]
  )

  return (
    <>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {images.map((img, i) => (
          <button
            key={img.key}
            onClick={() => open(i)}
            className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            aria-label={`Foto ${i + 1} öffnen`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-200 flex items-center justify-center">
              <svg
                className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition drop-shadow-lg"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          src={lightboxImages[lightboxIndex].src}
          alt={lightboxImages[lightboxIndex].alt}
          onClose={close}
          images={lightboxImages}
          index={lightboxIndex}
          onPrev={prev}
          onNext={next}
        />
      )}
    </>
  )
}

// ─── Skelett ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-gray-200 dark:bg-slate-800" />
      ))}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────
interface Props {
  prefix: string
  /** Überschrift anzeigen? Standard: true. Auf false setzen wenn CMS-Section schon einen Titel liefert. */
  showHeading?: boolean
}

export default function GalerieView({ prefix, showHeading = true }: Props) {
  const { theme } = useTheme()
  const dk = theme === 'dark'
  const [data, setData] = useState<BrowseResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    setData(null)
    fetch(`${API_BASE}/api/galerie/browse?prefix=${encodeURIComponent(prefix)}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => setData(d as BrowseResult))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [prefix])

  // Aktueller Ordner-Name aus Prefix
  const parts = prefix.replace(/\/$/, '').split('/').filter(Boolean)
  const currentName = parts[parts.length - 1] ?? 'galerie'

  return (
    <section className={`min-h-[60vh] ${dk ? 'bg-slate-950' : 'bg-white'}`}>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">

        {/* Breadcrumb */}
        <Breadcrumb prefix={prefix} />

        {/* Page heading */}
        {showHeading && (
          <h1 className="mb-8 text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
            {labelFor(currentName)}
          </h1>
        )}

        {loading && <Skeleton />}

        {error && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 text-6xl opacity-20">📷</div>
            <p className="text-gray-500 dark:text-gray-400">Galerie konnte nicht geladen werden.</p>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Folder grid */}
            {data.folders.length > 0 && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {data.folders.map(folder => {
                  const folderHref =
                    prefix === 'galerie/'
                      ? `/galerie/${folder.name}`
                      : `/galerie/${parts.slice(1).join('/')}/${folder.name}`
                  return <FolderCard key={folder.prefix} folder={folder} href={folderHref} />
                })}
              </div>
            )}

            {/* Photo count + grid */}
            {data.images.length > 0 && (
              <>
                <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
                  {data.images.length} Foto{data.images.length !== 1 ? 's' : ''}
                  {' '}· Klicken zum Öffnen · ← → zum Navigieren
                </p>
                <PhotoGrid images={data.images} />
              </>
            )}

            {/* Leer */}
            {data.folders.length === 0 && data.images.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="mb-4 text-6xl opacity-20">📂</div>
                <p className="text-gray-500 dark:text-gray-400">Dieser Bereich ist noch leer.</p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

