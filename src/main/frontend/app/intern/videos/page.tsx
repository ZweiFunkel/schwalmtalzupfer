'use client'
import { getApiBase } from '@/lib/api'
import React, { useEffect, useState, Suspense, useCallback } from 'react'
import { useAuth, isBoard } from '@/lib/auth'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import YouTubePlayer from '@/components/YouTubePlayer'

const API_BASE = getApiBase()
const SIDEBAR_COLLAPSED_KEY = 'stz-videos-sidebar-collapsed'

// ─── Types ────────────────────────────────────────────────────────────────────

interface VideoEntry {
  id: string
  category: 'SOMMER' | 'WINTER' | 'WEITERE'
  year: string | null
  day: string | null
  subcategory: string | null
  tags: string | null
  type: 'VIDEO' | 'PLAYLIST'
  youtubeId: string
  title: string
  thumbnailUrl: string | null
  position: number
}

interface PlaylistItem {
  videoId: string
  title: string
  thumbnail: string
}

type Selection =
  | { cat: 'SOMMER' | 'WINTER'; year: string; day: string | null; slot: string | null }
  | { cat: 'WEITERE'; sub: string }

// ─── URL helpers ──────────────────────────────────────────────────────────────

function encodeSelection(s: Selection): string {
  if (s.cat === 'WEITERE') return `WEITERE__${encodeURIComponent(s.sub)}`
  if (s.day && s.slot) return `${s.cat}__${s.year}__${encodeURIComponent(s.day)}__${encodeURIComponent(s.slot)}`
  if (s.day) return `${s.cat}__${s.year}__${encodeURIComponent(s.day)}`
  return `${s.cat}__${s.year}`
}

function decodeSelection(p: string | null): Selection | null {
  if (!p) return null
  const parts = p.split('__')
  if (parts[0] === 'WEITERE' && parts[1]) return { cat: 'WEITERE', sub: decodeURIComponent(parts[1]) }
  if ((parts[0] === 'SOMMER' || parts[0] === 'WINTER') && parts[1]) {
    return {
      cat: parts[0] as 'SOMMER' | 'WINTER',
      year: parts[1],
      day: parts[2] ? decodeURIComponent(parts[2]) : null,
      slot: parts[3] ? decodeURIComponent(parts[3]) : null,
    }
  }
  return null
}

// ─── Nav structure ────────────────────────────────────────────────────────────

const DAYS_ORDER = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

interface KonzertNavYear { year: string; days: string[] }
interface NavStructure { sommer: KonzertNavYear[]; winter: KonzertNavYear[]; weitere: string[] }

function buildNav(videos: VideoEntry[]): NavStructure {
  function konzertYears(cat: 'SOMMER' | 'WINTER'): KonzertNavYear[] {
    const catVids = videos.filter(v => v.category === cat)
    const years = [...new Set(catVids.map(v => v.year).filter(Boolean) as string[])].sort((a, b) => b.localeCompare(a))
    return years.map(year => ({
      year,
      days: DAYS_ORDER.filter(d => catVids.some(v => v.year === year && v.day === d)),
    }))
  }
  return {
    sommer: konzertYears('SOMMER'),
    winter: konzertYears('WINTER'),
    weitere: [...new Set(
      videos.filter(v => v.category === 'WEITERE').map(v => v.subcategory).filter(Boolean) as string[]
    )],
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function playlistEmbedSrc(playlistId: string, autoplay = true): string {
  const params = new URLSearchParams({ list: playlistId, rel: '0', modestbranding: '1' })
  if (autoplay) params.set('autoplay', '1')
  return `https://www.youtube-nocookie.com/embed/videoseries?${params}`
}

function ytUrl(v: VideoEntry): string {
  if (v.type === 'PLAYLIST') return `https://www.youtube.com/playlist?list=${v.youtubeId}`
  return `https://www.youtube.com/watch?v=${v.youtubeId}`
}

function thumbnailFor(v: VideoEntry): string | null {
  return v.thumbnailUrl ?? (v.type === 'VIDEO' ? `https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg` : null)
}

function parseTags(tags: string | null): string[] {
  if (!tags) return []
  try { return JSON.parse(tags) } catch { return [] }
}

function extractYear(tags: string | null): string | null {
  return parseTags(tags).find(t => /^\d{4}$/.test(t)) ?? null
}

function selectionLabel(sel: Selection | null): string {
  if (!sel) return 'Auswahl'
  if (sel.cat === 'WEITERE') return sel.sub
  const base = sel.cat === 'SOMMER' ? 'Sommerkonzert' : 'Winterkonzert'
  let label = `${base} ${sel.year}`
  if (sel.day) label += ` – ${sel.day}`
  if (sel.slot) label += ` (${sel.slot})`
  return label
}

function isSel(sel: Selection | null, item: Selection): boolean {
  if (!sel || sel.cat !== item.cat) return false
  if (sel.cat === 'WEITERE' && item.cat === 'WEITERE') return sel.sub === item.sub
  if (sel.cat !== 'WEITERE' && item.cat !== 'WEITERE') return sel.year === item.year && sel.day === item.day && sel.slot === item.slot
  return false
}

// Videos für eine Auswahl, in derselben Reihenfolge wie in Konzert-/Weitere-Content
// gezeigt (Backend liefert bereits nach position/title sortiert). Wird sowohl für
// die Anzeige als auch fürs automatische Öffnen des ersten Videos genutzt (wie bei
// YouTube: Playlist auswählen → erstes Video spielt sofort, Rest steht rechts).
function videosForSelection(videos: VideoEntry[], sel: Selection): VideoEntry[] {
  if (sel.cat === 'WEITERE') {
    return videos
      .filter(v => v.category === 'WEITERE' && v.subcategory === sel.sub)
      .sort((a, b) => a.position - b.position)
  }
  return videos.filter(v => v.category === sel.cat && v.year === sel.year
    && (sel.day ? v.day === sel.day : true)
    && (sel.slot ? v.subcategory === sel.slot : true))
}

// ─── Icons (klein gehalten, wiederverwendet) ─────────────────────────────────

function PlaylistIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h8" />
    </svg>
  )
}

function PlayIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={`${className} translate-x-0.5`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4l15 8-15 8V4z" />
    </svg>
  )
}

function YouTubeIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
    </svg>
  )
}

// Klassisches YouTube-Kinomodus-Symbol: ein breites Rechteck.
function TheaterIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="7" width="18" height="10" rx="1.5" />
    </svg>
  )
}

function FullscreenIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V5a1 1 0 011-1h4M15 4h4a1 1 0 011 1v4M20 15v4a1 1 0 01-1 1h-4M9 20H5a1 1 0 01-1-1v-4" />
    </svg>
  )
}

function CloseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function PipIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <rect x="12" y="12" width="6.5" height="4.5" rx="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function LinkIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  )
}

// Pfeil für Ein-/Ausblenden-Umschalter (Archiv-Seitenleiste, Playlist-Panel):
// zeigt standardmäßig nach links (zugeklappt-Richtung), dreht sich beim
// Umschalten sanft um 180°.
function CollapseArrowIcon({ collapsed, className = 'h-4 w-4' }: { collapsed: boolean; className?: string }) {
  return (
    <svg className={`${className} shrink-0 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

// ─── Video Card (Grid-Kachel im YouTube-Stil) ────────────────────────────────

function VideoCard({ video, onOpen }: { video: VideoEntry; onOpen: (v: VideoEntry) => void }) {
  const thumbnailUrl = thumbnailFor(video)
  const isPlaylist = video.type === 'PLAYLIST'

  return (
    <div className="group cursor-pointer" onClick={() => onOpen(video)}>
      <div className="relative">
        {/* Gestapelter Karten-Effekt für Playlists */}
        {isPlaylist && (
          <>
            <div className="absolute inset-0 translate-x-2.5 translate-y-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-200 dark:bg-slate-800" aria-hidden />
            <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-slate-800/80" aria-hidden />
          </>
        )}
        <div className="relative aspect-video overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-slate-800 shadow-md">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailUrl} alt={video.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-900">
              <PlaylistIcon className="h-8 w-8 text-gray-400 dark:text-slate-600" />
              <span className="text-xs font-medium text-gray-400 dark:text-slate-500">Playlist</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10 transition-all duration-200 group-hover:bg-black/50">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 shadow-2xl transition-all duration-200 scale-90 opacity-70 group-hover:scale-100 group-hover:opacity-100">
              <PlayIcon className="h-6 w-6 text-white" />
            </div>
          </div>
          {isPlaylist && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/80 px-2 py-1 text-xs font-medium text-white">
              <PlaylistIcon className="h-3 w-3" />
              Playlist
            </div>
          )}
        </div>
      </div>
      <div className="flex items-start justify-between gap-2 px-0.5 pt-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 line-clamp-2 group-hover:text-gray-900 dark:group-hover:text-white transition">
          {video.title}
        </p>
        <a
          href={ytUrl(video)}
          target="_blank"
          rel="noopener noreferrer"
          title="Direkt auf YouTube"
          className="shrink-0 rounded-lg p-1.5 -mt-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition"
          onClick={e => e.stopPropagation()}
        >
          <YouTubeIcon />
        </a>
      </div>
    </div>
  )
}

// ─── Grid & Playlist-Shelf (YouTube-artige Sektionen) ────────────────────────

function VideoGrid({ videos, onOpen }: { videos: VideoEntry[]; onOpen: (v: VideoEntry) => void }) {
  return (
    <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
      {videos.map(v => <VideoCard key={v.id} video={v} onOpen={onOpen} />)}
    </div>
  )
}

// Zeigt den Inhalt einer Playlist direkt als Grid (lädt selbst über die
// Playlist-API), statt nur eine Karte zu zeigen, die man erst anklicken muss,
// um die enthaltenen Videos überhaupt zu sehen - wie YouTubes eigene
// Playlist-Seite: man sieht sofort, was drin ist, und wählt gezielt aus.
function InlinePlaylistItems({ playlist, onOpen }: {
  playlist: VideoEntry
  onOpen: (v: VideoEntry, startVideoId?: string) => void
}) {
  const [items, setItems] = useState<PlaylistItem[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setItems(null)
    fetch(`${API_BASE}/api/intern/videos/playlist/${playlist.youtubeId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: PlaylistItem[]) => { if (!cancelled) setItems(data) })
      .catch(() => { if (!cancelled) setItems([]) })
    return () => { cancelled = true }
  }, [playlist.youtubeId])

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <PlaylistIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{playlist.title}</h3>
        {items && <span className="text-xs text-gray-400 dark:text-gray-500">· {items.length} Videos</span>}
      </div>
      {items === null ? (
        <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="aspect-video animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Keine Videos in dieser Playlist gefunden.</p>
      ) : (
        <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(item => (
            <div key={item.videoId} className="group cursor-pointer" onClick={() => onOpen(playlist, item.videoId)}>
              <div className="relative aspect-video overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-slate-800 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10 transition-all duration-200 group-hover:bg-black/50">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 shadow-2xl transition-all duration-200 scale-90 opacity-70 group-hover:scale-100 group-hover:opacity-100">
                    <PlayIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
              <p className="px-0.5 pt-3 text-sm font-medium text-gray-700 dark:text-gray-200 line-clamp-2 group-hover:text-gray-900 dark:group-hover:text-white transition">
                {item.title}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Kachel für einen Tag (z.B. "Freitag") auf der Tage-Übersicht einer
// Konzertreihe: zeigt das erste Video der Tages-Playlist als Titelbild
// (manuelles thumbnailUrl hat Vorrang), Klick springt zur Playlist des Tages.
function DayCard({ day, entries, onSelect }: { day: string; entries: VideoEntry[]; onSelect: () => void }) {
  const representative = entries.find(v => v.type === 'PLAYLIST') ?? entries[0]
  const manualThumb = thumbnailFor(representative)
  const [items, setItems] = useState<PlaylistItem[] | null>(null)

  useEffect(() => {
    if (representative.type !== 'PLAYLIST') return
    let cancelled = false
    fetch(`${API_BASE}/api/intern/videos/playlist/${representative.youtubeId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: PlaylistItem[]) => { if (!cancelled) setItems(data) })
      .catch(() => { if (!cancelled) setItems([]) })
    return () => { cancelled = true }
  }, [representative])

  const thumb = manualThumb ?? items?.[0]?.thumbnail ?? null
  const count = representative.type === 'PLAYLIST' ? items?.length : entries.length

  return (
    <button onClick={onSelect} className="group text-left">
      <div className="relative aspect-video overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-slate-800 shadow-md">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={day} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-900">
            <PlaylistIcon className="h-8 w-8 text-gray-400 dark:text-slate-600" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10 transition-all duration-200 group-hover:bg-black/50">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 shadow-2xl transition-all duration-200 scale-90 opacity-70 group-hover:scale-100 group-hover:opacity-100">
            <PlayIcon className="h-6 w-6 text-white" />
          </div>
        </div>
      </div>
      <div className="px-0.5 pt-3">
        <p className="text-base font-semibold text-gray-800 dark:text-white transition group-hover:text-gray-900 dark:group-hover:text-white">{day}</p>
        {count != null && <p className="text-xs text-gray-400 dark:text-gray-500">{count} {count === 1 ? 'Video' : 'Videos'}</p>}
      </div>
    </button>
  )
}

// Kachel-Übersicht statt geflatteter Videoliste, wenn eine Ebene (Tage eines
// Jahres, oder Zeitabschnitte innerhalb eines Tages wie Sonntag Morgen/Abend)
// mehrere Kinder hat und noch keins ausgewählt ist - wie bei YouTube: erst die
// Playlist wählen, dann die enthaltenen Videos. `groupBy` legt fest, welches
// Feld die Ebene bildet (v.day für Tage, v.subcategory für Zeitabschnitte).
function DayPickerGrid({ videos, keys, groupBy, onSelect }: {
  videos: VideoEntry[]; keys: string[]; groupBy: (v: VideoEntry) => string | null; onSelect: (key: string) => void
}) {
  return (
    <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
      {keys.map(key => {
        const entries = videos.filter(v => groupBy(v) === key).sort((a, b) => a.position - b.position)
        if (entries.length === 0) return null
        return <DayCard key={key} day={key} entries={entries} onSelect={() => onSelect(key)} />
      })}
    </div>
  )
}

function SplitVideos({ items, onOpen }: { items: VideoEntry[]; onOpen: (v: VideoEntry, startVideoId?: string) => void }) {
  const playlists = items.filter(v => v.type === 'PLAYLIST')
  const singles = items.filter(v => v.type === 'VIDEO')
  return (
    <div>
      {playlists.map(p => <InlinePlaylistItems key={p.id} playlist={p} onOpen={onOpen} />)}
      {singles.length > 0 && (
        <>
          {playlists.length > 0 && (
            <div className="mb-3 flex items-center gap-2">
              <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Videos</h3>
            </div>
          )}
          <VideoGrid videos={singles} onOpen={onOpen} />
        </>
      )}
    </div>
  )
}

// ─── Watch-Bereich: normale Ansicht → Kinomodus → Miniplayer ─────────────────
// Vollbild wird bewusst NICHT mehr selbst verwaltet, sondern komplett YouTube
// überlassen (dessen eigener Steuerungsbutton, dank controls:1 immer sichtbar):
// eigenes Vollbild hätte den WRAPPER (nicht das Iframe) zum Fullscreen-Element
// gemacht - YouTubes eigener "Verkleinern"-Button im Iframe wusste davon nichts
// und konnte dadurch nicht mehr rauswechseln, nur ESC hat funktioniert.
// "Kinomodus" verbreitert den Player wie bei YouTube (Playlist bleibt rechts,
// nur die Archiv-Seitenleiste klappt automatisch ein) statt ihn nur innerhalb
// der Spalte zu verbreitern.
//
// Miniplayer gibt es in zwei Varianten:
// 1. In-Page-Miniplayer (bisheriges Verhalten): erscheint unten rechts IM
//    Browserfenster, sobald der Player beim Scrollen den Viewport verlässt.
//    Funktioniert überall, bleibt aber auf das Browserfenster beschränkt.
// 2. Systemweiter Miniplayer (Document Picture-in-Picture API, Chrome/Edge):
//    ein echtes eigenes Fenster, das frei über alle Bildschirme verschoben
//    werden kann, sogar außerhalb des Browsers. Wird per Button aktiv
//    angefordert; wo die API fehlt (Firefox/Safari) bleibt Variante 1 die
//    einzige Option - eine echte Browser-Grenze, kein technisches Versäumnis.

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>
      window: Window | null
    }
  }
}

function WatchArea({
  initialVideo, pool, onClose, theaterMode, onTheaterModeChange, initialPlaylistVideoId, selectionParam,
}: {
  initialVideo: VideoEntry
  pool: VideoEntry[]
  onClose: () => void
  theaterMode: boolean
  onTheaterModeChange: (v: boolean) => void
  /** Springt beim ersten Laden direkt zu diesem Video innerhalb der Playlist,
   *  statt immer beim ersten Eintrag zu starten (z.B. wenn aus der direkten
   *  Playlist-Übersicht ein bestimmtes Video angeklickt wurde). */
  initialPlaylistVideoId?: string
  /** Kodierte aktuelle Auswahl (wie im v=-Parameter), für den "Link kopieren"-Button. */
  selectionParam: string
}) {
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const placeholderParentRef = React.useRef<HTMLDivElement>(null)
  const sentinelRef = React.useRef<HTMLDivElement>(null)
  const lastHeightRef = React.useRef(0)
  const dragStateRef = React.useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null)
  const pipWindowRef = React.useRef<Window | null>(null)
  const [activeVideo, setActiveVideo] = useState(initialVideo)
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([])
  const [playlistLoading, setPlaylistLoading] = useState(initialVideo.type === 'PLAYLIST')
  const [currentVideoId, setCurrentVideoId] = useState(activeVideo.type === 'VIDEO' ? activeVideo.youtubeId : '')
  const [manualMiniOpen, setManualMiniOpen] = useState(false)
  const [miniPos, setMiniPos] = useState<{ left: number; top: number } | null>(null)
  const [systemPipActive, setSystemPipActive] = useState(false)
  const [systemPipSupported, setSystemPipSupported] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [playlistCollapsed, setPlaylistCollapsed] = useState(false)

  useEffect(() => {
    setSystemPipSupported(typeof window !== 'undefined' && !!window.documentPictureInPicture)
  }, [])

  // Miniplayer nur noch per Klick auf den Auslöser, nicht mehr automatisch
  // beim Runterscrollen.
  const mini = !systemPipActive && manualMiniOpen

  useEffect(() => {
    if (!mini) setMiniPos(null)
  }, [mini])

  // Hält die zuletzt gerenderte Höhe des normalen (nicht-mini) Bereichs fest, damit beim
  // Umschalten auf den (position:fixed, also aus dem Textfluss genommenen) Mini-Player ein
  // gleich hoher Platzhalter eingesetzt werden kann - sonst rutscht der gesamte Seiteninhalt
  // beim Verkleinern/Wiederherstellen abrupt um die fehlende/wiederkehrende Höhe.
  useEffect(() => {
    if (mini) return
    const el = wrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => { lastHeightRef.current = entry.contentRect.height })
    ro.observe(el)
    return () => ro.disconnect()
  }, [mini])

  // Mini-Player verschiebbar machen. Pointer Capture sorgt dafür, dass Move/Up-Events
  // auch dann noch an den Griff gehen, wenn der Zeiger währenddessen über das YouTube-
  // Iframe wandert (das Iframe würde die Events sonst selbst abfangen).
  function onDragPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const box = wrapperRef.current
    if (!box) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = box.getBoundingClientRect()
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, startLeft: rect.left, startTop: rect.top }
  }
  function onDragPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current
    const box = wrapperRef.current
    if (!drag || !box) return
    const rect = box.getBoundingClientRect()
    const nextLeft = drag.startLeft + (e.clientX - drag.startX)
    const nextTop = drag.startTop + (e.clientY - drag.startY)
    const clampedLeft = Math.min(Math.max(nextLeft, 8), window.innerWidth - rect.width - 8)
    const clampedTop = Math.min(Math.max(nextTop, 8), window.innerHeight - rect.height - 8)
    setMiniPos({ left: clampedLeft, top: clampedTop })
  }
  function onDragPointerUp() {
    dragStateRef.current = null
  }

  function expandFromMini() {
    setManualMiniOpen(false)
    sentinelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Systemweiter Miniplayer: verschiebt den Player-Wrapper physisch in ein
  // eigenständiges Document-Picture-in-Picture-Fenster (echtes Browser-Fenster,
  // frei über alle Bildschirme verschiebbar). Stylesheets werden mitkopiert,
  // damit Tailwind-Klassen im neuen Fenster (eigenes Document!) weiter greifen.
  async function openSystemPip() {
    if (!window.documentPictureInPicture || !wrapperRef.current) return
    try {
      const pipWindow = await window.documentPictureInPicture.requestWindow({ width: 400, height: 225 })
      pipWindowRef.current = pipWindow
      document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => {
        pipWindow.document.head.appendChild(node.cloneNode(true))
      })
      pipWindow.document.body.style.margin = '0'
      pipWindow.document.body.style.background = '#000'
      pipWindow.document.body.appendChild(wrapperRef.current)
      setSystemPipActive(true)
      pipWindow.addEventListener('pagehide', () => {
        if (placeholderParentRef.current && wrapperRef.current) {
          placeholderParentRef.current.appendChild(wrapperRef.current)
        }
        pipWindowRef.current = null
        setSystemPipActive(false)
      })
    } catch (e) {
      console.error('Systemweiter Miniplayer konnte nicht geöffnet werden:', e)
    }
  }
  function closeSystemPip() {
    pipWindowRef.current?.close()
  }

  // Baut einen direkten Link auf genau dieses Video (auch innerhalb einer
  // Playlist), damit man z.B. im "Was ist neu?"-Eintrag gezielt hierher
  // verlinken kann, statt nur auf die Kategorie im Allgemeinen.
  function copyDeepLink() {
    if (!currentVideoId || !selectionParam) return
    const url = `${window.location.origin}/intern/videos?v=${selectionParam}&video=${currentVideoId}`
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }).catch(() => {})
  }

  // Playlist-Inhalte laden, sobald ein Playlist-Eintrag aktiv wird
  useEffect(() => {
    if (activeVideo.type === 'VIDEO') {
      setCurrentVideoId(activeVideo.youtubeId)
      setPlaylistItems([])
      return
    }
    let cancelled = false
    setPlaylistLoading(true)
    setCurrentVideoId('')
    fetch(`${API_BASE}/api/intern/videos/playlist/${activeVideo.youtubeId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((items: PlaylistItem[]) => {
        if (cancelled) return
        setPlaylistItems(items)
        if (items.length > 0) {
          const wanted = initialPlaylistVideoId && items.some(i => i.videoId === initialPlaylistVideoId)
            ? initialPlaylistVideoId
            : items[0].videoId
          setCurrentVideoId(wanted)
        }
      })
      .catch(() => { if (!cancelled) setPlaylistItems([]) })
      .finally(() => { if (!cancelled) setPlaylistLoading(false) })
    return () => { cancelled = true }
  }, [activeVideo])

  const isPlaylist = activeVideo.type === 'PLAYLIST'
  // Fallback: Wenn die Playlist-API keine Items liefert (z.B. fehlender YouTube-API-Key),
  // direkt die YouTube-Playlist als Embed laden – hier ist keine onError-Erkennung möglich.
  const useIframeFallback = isPlaylist && !playlistLoading && playlistItems.length === 0
  const currentPlaylistItem = playlistItems.find(i => i.videoId === currentVideoId)
  const currentTitle = currentPlaylistItem?.title ?? activeVideo.title
  const currentThumb = currentPlaylistItem?.thumbnail
    ?? activeVideo.thumbnailUrl
    ?? (currentVideoId ? `https://img.youtube.com/vi/${currentVideoId}/hqdefault.jpg` : null)

  function handleEnded() {
    if (!isPlaylist) return
    const idx = playlistItems.findIndex(i => i.videoId === currentVideoId)
    if (idx >= 0 && idx < playlistItems.length - 1) {
      setCurrentVideoId(playlistItems[idx + 1].videoId)
    }
  }

  function switchTo(v: VideoEntry) {
    setActiveVideo(v)
  }

  const related = pool.filter(v => v.id !== activeVideo.id)
  const playlistFullyCollapsed = isPlaylist && playlistCollapsed
  const hasRelated = related.length > 0 && !playlistFullyCollapsed
  // Eingeklappte Playlist blendet "Weitere Videos" mit aus (statt sie weiter
  // stehen zu lassen) - dadurch braucht die Spalte auch keine feste 360px-
  // Breite mehr, sondern schrumpft komplett auf reinen Icon-Platzbedarf.
  const railNarrow = playlistFullyCollapsed

  const sideRail = (isPlaylist || hasRelated) && !mini && (
    <div className={theaterMode
      ? 'flex flex-col gap-6'
      // lg:w-14/lg:w-[360px] + transition-[width]: die Spalte animiert selbst
      // sanft zwischen schmal (nur Icon) und voller Breite - eine feste
      // Pixelbreite lässt sich (anders als CSS-Grid-"auto"-Spalten) sauber
      // animieren, und dank overflow-x-hidden reißt während der Animation
      // nichts sichtbar aus dem Rahmen.
      : `flex max-h-[calc(100vh-8rem)] flex-col gap-6 overflow-y-auto overflow-x-hidden lg:sticky lg:top-24 lg:shrink-0 transition-[width] duration-300 ease-in-out ${railNarrow ? 'lg:w-14' : 'lg:w-[360px]'}`
    }>
      {isPlaylist && (
        railNarrow ? (
          <div className="flex justify-center">
            <button
              onClick={() => setPlaylistCollapsed(v => !v)}
              title="Playlist einblenden"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 transition hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <ChevronIcon open={false} className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setPlaylistCollapsed(v => !v)}
              title={playlistCollapsed ? 'Playlist einblenden' : 'Playlist ausblenden'}
              className="mb-3 flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <ChevronIcon open={!playlistCollapsed} className="h-3.5 w-3.5" />
                Playlist
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">{playlistItems.length} Videos</span>
            </button>
            {/* Hier ist die Spaltenbreite immer fest (Weitere Videos brauchen
                den Platz noch), daher darf die Liste hier sanft per Höhe
                ein-/ausklappen statt komplett aus dem DOM zu verschwinden. */}
            <div className={`grid transition-all duration-300 ease-in-out ${playlistCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
              <div className="overflow-hidden">
                <div className="flex flex-col gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-2">
                  {playlistLoading ? (
                    [1, 2, 3, 4].map(i => <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" />)
                  ) : playlistItems.length === 0 ? (
                    <p className="px-2 py-4 text-center text-xs text-gray-400 dark:text-gray-500">Keine Videos gefunden</p>
                  ) : playlistItems.map((item, idx) => (
                    <button
                      key={item.videoId}
                      onClick={() => setCurrentVideoId(item.videoId)}
                      className={`flex gap-2 rounded-lg p-2 text-left transition ${
                        currentVideoId === item.videoId
                          ? 'bg-green-600 text-white'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'
                      }`}
                    >
                      <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded bg-gray-200 dark:bg-slate-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.thumbnail} alt="" className="h-full w-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <span className="text-[10px] font-bold text-white">{idx + 1}</span>
                        </div>
                      </div>
                      <p className="min-w-0 flex-1 line-clamp-2 text-xs font-medium">{item.title}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {hasRelated && (
        <div>
          <span className="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-200">Weitere Videos</span>
          <div className="flex flex-col gap-3">
            {related.map(v => {
              const thumb = thumbnailFor(v)
              return (
                <button key={v.id} onClick={() => switchTo(v)} className="group flex gap-2 text-left">
                  <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg bg-gray-200 dark:bg-slate-800">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <PlaylistIcon className="h-6 w-6 text-gray-400 dark:text-slate-600" />
                      </div>
                    )}
                    {v.type === 'PLAYLIST' && (
                      <div className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        Playlist
                      </div>
                    )}
                  </div>
                  <p className="min-w-0 flex-1 line-clamp-3 text-xs font-medium text-gray-700 dark:text-gray-200">{v.title}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Markiert die ursprüngliche Position des Players für IntersectionObserver + Zurückspringen aus dem Mini-Player */}
      <div ref={sentinelRef} aria-hidden />
      {/* Platzhalter in Originalhöhe, damit der Seiteninhalt beim Verkleinern/Wiederherstellen
          nicht abrupt springt (der eigentliche Wrapper wird beim Mini-Player aus dem Textfluss
          genommen, siehe lastHeightRef oben). */}
      {mini && <div style={{ height: lastHeightRef.current }} aria-hidden />}
      <div ref={placeholderParentRef} className={mini ? undefined : 'mb-10'}>
        <div
          ref={wrapperRef}
          className={mini
            ? 'fixed z-50 w-72 select-none rounded-xl bg-black shadow-2xl ring-1 ring-black/20 sm:w-80'
            : `mx-auto max-w-5xl lg:mx-0 lg:max-w-none flex flex-col gap-6 transition-all duration-300 ${theaterMode ? '' : 'lg:flex-row'}`
          }
          style={mini ? (miniPos ? { left: miniPos.left, top: miniPos.top } : { right: 16, bottom: 16 }) : undefined}
        >
        {mini && (
          <div
            onPointerDown={onDragPointerDown}
            onPointerMove={onDragPointerMove}
            onPointerUp={onDragPointerUp}
            onPointerCancel={onDragPointerUp}
            className="flex touch-none items-center gap-1 rounded-t-xl bg-gray-900 px-2 py-1.5 cursor-move"
          >
            <span className="flex-1 truncate text-xs font-medium text-white">{currentTitle}</span>
            <button
              onClick={expandFromMini}
              onPointerDown={e => e.stopPropagation()}
              title="Zur normalen Ansicht"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
              <FullscreenIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onClose}
              onPointerDown={e => e.stopPropagation()}
              title="Schließen"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-300 transition hover:bg-white/10 hover:text-white"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className={mini ? undefined : 'min-w-0 lg:flex-1'}>
          <div
            className={`relative w-full overflow-hidden bg-black ${mini ? 'rounded-b-xl' : 'shadow-2xl rounded-xl'}`}
            style={{ aspectRatio: '16/9' }}
          >
          {useIframeFallback ? (
            <iframe
              src={playlistEmbedSrc(activeVideo.youtubeId)}
              title={currentTitle}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          ) : currentVideoId ? (
            <YouTubePlayer
              videoId={currentVideoId}
              title={currentTitle}
              thumbnailUrl={currentThumb}
              autoplay
              onEnded={handleEnded}
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
              {playlistLoading ? 'Lade Playlist…' : 'Keine Videos gefunden'}
            </div>
          )}
          </div>

        {!mini && (
          <>
            {/* Titel + Normal/Theater/Mini-Steuerung */}
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">{currentTitle}</h2>
                {isPlaylist && (
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Playlist · {activeVideo.title}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => onTheaterModeChange(!theaterMode)}
                  title={theaterMode ? 'Standardansicht' : 'Kinomodus'}
                  aria-pressed={theaterMode}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                    theaterMode
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
                  }`}
                >
                  <TheaterIcon />
                </button>
                <button
                  onClick={copyDeepLink}
                  title={linkCopied ? 'Link kopiert!' : 'Link zu diesem Video kopieren'}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/10"
                >
                  {linkCopied ? (
                    <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : <LinkIcon />}
                </button>
                {systemPipSupported && (
                  <button
                    onClick={systemPipActive ? closeSystemPip : openSystemPip}
                    title={systemPipActive ? 'Systemweiten Miniplayer schließen' : 'Systemweiter Miniplayer (frei über alle Bildschirme verschiebbar)'}
                    aria-pressed={systemPipActive}
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                      systemPipActive
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
                    }`}
                  >
                    <PipIcon />
                  </button>
                )}
                <a
                  href={currentVideoId ? `https://www.youtube.com/watch?v=${currentVideoId}` : ytUrl(activeVideo)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Auf YouTube ansehen"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/10 hover:text-red-500 dark:hover:text-red-400"
                >
                  <YouTubeIcon className="h-4 w-4" />
                </a>
                <button
                  onClick={onClose}
                  title="Schließen"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/10"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
          </>
        )}
        </div>

        {sideRail}
        </div>
      </div>
    </>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyVideos({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 dark:border-white/10 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-slate-800">
        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">Noch keine Videos vorhanden</p>
    </div>
  )
}

// ─── Content: Konzert ─────────────────────────────────────────────────────────

function KonzertContent({ videos, cat, year, day, slot, onOpen, onSelectDay, onSelectSlot }: {
  videos: VideoEntry[]; cat: 'SOMMER' | 'WINTER'; year: string; day: string | null; slot: string | null
  onOpen: (v: VideoEntry, pool: VideoEntry[], startVideoId?: string) => void
  onSelectDay: (day: string) => void
  onSelectSlot: (slot: string) => void
}) {
  const yearVideos = videos.filter(v => v.category === cat && v.year === year)
  const days = DAYS_ORDER.filter(d => yearVideos.some(v => v.day === d))

  // Mehrere Tage und noch keiner ausgewählt: erst Tage-Übersicht zeigen,
  // statt alle Tage direkt zu einer Liste zusammenzufassen.
  if (!day && days.length > 1) {
    return <DayPickerGrid videos={yearVideos} keys={days} groupBy={v => v.day} onSelect={onSelectDay} />
  }

  const dayVideos = yearVideos.filter(v => (day ? v.day === day : true))

  // Dritte Ebene: ein Tag kann in mehrere Zeitabschnitte unterteilt sein
  // (z.B. Sonntag Morgen/Abend) - subcategory wird dafür bei Sommer-/
  // Winterkonzert-Einträgen zweckentfremdet (sonst nur für "Weitere Auftritte" genutzt).
  const slots = day
    ? [...new Set(dayVideos.map(v => v.subcategory).filter(Boolean) as string[])]
    : []

  if (day && !slot && slots.length > 1) {
    return <DayPickerGrid videos={dayVideos} keys={slots} groupBy={v => v.subcategory} onSelect={onSelectSlot} />
  }

  const shown = dayVideos.filter(v => (slot ? v.subcategory === slot : true))
  const label = `${cat === 'SOMMER' ? 'Sommerkonzert' : 'Winterkonzert'} ${year}${day ? ` – ${day}` : ''}${slot ? ` (${slot})` : ''}`
  if (shown.length === 0) return <EmptyVideos label={label} />
  return <SplitVideos items={shown} onOpen={(v, startVideoId) => onOpen(v, shown, startVideoId)} />
}

// ─── Content: Weitere ─────────────────────────────────────────────────────────

function WeitereContent({ videos, sub, onOpen }: {
  videos: VideoEntry[]; sub: string
  onOpen: (v: VideoEntry, pool: VideoEntry[], startVideoId?: string) => void
}) {
  const subVideos = videos
    .filter(v => v.category === 'WEITERE' && v.subcategory === sub)
    .sort((a, b) => a.position - b.position)

  if (subVideos.length === 0) return <EmptyVideos label={sub} />

  const handleOpen = (v: VideoEntry, startVideoId?: string) => onOpen(v, subVideos, startVideoId)

  // Group by year tag; '' = no year tag
  const byYear = new Map<string, VideoEntry[]>()
  for (const v of subVideos) {
    const yr = extractYear(v.tags) ?? ''
    if (!byYear.has(yr)) byYear.set(yr, [])
    byYear.get(yr)!.push(v)
  }

  if (byYear.size <= 1) {
    return <SplitVideos items={subVideos} onOpen={handleOpen} />
  }

  return (
    <div className="flex flex-col gap-8">
      {[...byYear.entries()]
        .sort(([a], [b]) => (b || '0').localeCompare(a || '0'))
        .map(([year, vids]) => (
          <div key={year}>
            <div className="mb-4 flex items-center gap-3">
              <span className="text-sm font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{year || 'Weitere'}</span>
              <span className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
            </div>
            <SplitVideos items={vids} onOpen={handleOpen} />
          </div>
        ))}
    </div>
  )
}

// ─── Sidebar nav ──────────────────────────────────────────────────────────────

function SunIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  )
}
function SnowflakeIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M4.5 6l15 12M4.5 18l15-12" />
    </svg>
  )
}
function StarIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  )
}

function ChevronIcon({ open, className = 'h-3.5 w-3.5' }: { open: boolean; className?: string }) {
  return (
    <svg className={`${className} shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function NavItem({ active, onClick, children, indent = false }: {
  active: boolean; onClick: () => void; children: React.ReactNode; indent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-sm transition-colors duration-150 rounded-lg px-3 py-1.5 flex items-center gap-2 ${indent ? 'pl-6' : ''}
        ${active
          ? 'bg-green-600 text-white font-medium'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
        }`}
    >
      {children}
    </button>
  )
}

function SidebarSection({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5 px-2 text-gray-400 dark:text-gray-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      {children}
    </div>
  )
}

function SidebarNav({ nav, selection, onSelect }: {
  nav: NavStructure
  selection: Selection | null
  onSelect: (s: Selection) => void
}) {
  // Jahre mit Tage-Aufschlüsselung sind standardmäßig eingeklappt (nur das
  // Jahr der aktuellen Auswahl ist sichtbar aufgeklappt) - wie bei YouTubes
  // eigener Seitenleiste, statt alles auf einmal auszubreiten.
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (selection && selection.cat !== 'WEITERE') {
      const key = `${selection.cat}__${selection.year}`
      setExpandedYears(prev => prev.has(key) ? prev : new Set(prev).add(key))
    }
  }, [selection])

  function toggleYear(key: string) {
    setExpandedYears(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  function KonzertSection({ cat, label, icon, years }: {
    cat: 'SOMMER' | 'WINTER'; label: string; icon: React.ReactNode; years: KonzertNavYear[]
  }) {
    return (
      <SidebarSection label={label} icon={icon}>
        {years.length === 0 ? (
          <p className="px-3 pb-1 text-xs italic text-gray-400 dark:text-gray-600">Keine Videos</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {years.map(({ year, days }) => {
              if (days.length === 0) {
                return (
                  <NavItem key={year} active={isSel(selection, { cat, year, day: null, slot: null })} onClick={() => onSelect({ cat, year, day: null, slot: null })}>
                    {year}
                  </NavItem>
                )
              }
              const key = `${cat}__${year}`
              const open = expandedYears.has(key)
              return (
                <div key={year}>
                  <div className="flex items-center gap-0.5">
                    <div className="flex-1">
                      <NavItem active={isSel(selection, { cat, year, day: null, slot: null })} onClick={() => onSelect({ cat, year, day: null, slot: null })}>
                        <span>{year}</span>
                        <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">{days.length}d</span>
                      </NavItem>
                    </div>
                    <button
                      onClick={() => toggleYear(key)}
                      title={open ? 'Tage einklappen' : 'Tage anzeigen'}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <ChevronIcon open={open} />
                    </button>
                  </div>
                  {open && (
                    <div className="relative ml-3.5 mt-0.5 mb-1 flex flex-col gap-0.5">
                      <div className="absolute left-0 top-1 bottom-1 w-px bg-gray-200 dark:bg-white/10" />
                      {days.map(day => (
                        <NavItem key={day} active={isSel(selection, { cat, year, day, slot: null })} onClick={() => onSelect({ cat, year, day, slot: null })} indent>
                          {day}
                        </NavItem>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </SidebarSection>
    )
  }

  return (
    <nav className="flex flex-col gap-6">
      <KonzertSection cat="SOMMER" label="Sommerkonzert" icon={<SunIcon />} years={nav.sommer} />
      <KonzertSection cat="WINTER" label="Winterkonzert" icon={<SnowflakeIcon />} years={nav.winter} />

      <SidebarSection label="Weitere Auftritte" icon={<StarIcon />}>
        {nav.weitere.length === 0 ? (
          <p className="px-3 pb-1 text-xs italic text-gray-400 dark:text-gray-600">Keine Videos</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {nav.weitere.map(sub => (
              <NavItem key={sub} active={isSel(selection, { cat: 'WEITERE', sub })} onClick={() => onSelect({ cat: 'WEITERE', sub })}>
                {sub}
              </NavItem>
            ))}
          </div>
        )}
      </SidebarSection>
    </nav>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function VideosPageInner() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [videos, setVideos] = useState<VideoEntry[]>([])
  const [videosLoading, setVideosLoading] = useState(true)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  const [watch, setWatch] = useState<{ video: VideoEntry; pool: VideoEntry[]; startVideoId?: string } | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [theaterMode, setTheaterMode] = useState(false)

  // Wie bei YouTube: Kinomodus klappt automatisch die (bei uns: Archiv-)
  // Seitenleiste ein, damit dem Video maximale Breite bleibt. Beim Verlassen
  // des Kinomodus bleibt der Zustand bewusst so, wie er zuletzt manuell
  // gesetzt wurde (kein automatisches Wiederausklappen - genau wie bei YouTube).
  const sidebarBeforeTheaterRef = React.useRef<boolean | null>(null)

  // Kinomodus klappt automatisch die Archiv-Seitenleiste ein (mehr Platz fürs
  // Video, wie YouTubes eigene globale Seitenleiste im Kinomodus) - beim
  // Verlassen wird genau der Zustand von davor wiederhergestellt, statt sie
  // einfach eingeklappt zu lassen.
  function handleTheaterModeChange(next: boolean) {
    setTheaterMode(next)
    if (next) {
      sidebarBeforeTheaterRef.current = sidebarCollapsed
      setSidebarCollapsed(true)
    } else if (sidebarBeforeTheaterRef.current !== null) {
      setSidebarCollapsed(sidebarBeforeTheaterRef.current)
      sidebarBeforeTheaterRef.current = null
    }
  }

  useEffect(() => { document.title = 'Videos – Schwalmtalzupfer' }, [])

  // Einklappzustand der Archiv-Seitenleiste merken (wie bei YouTube).
  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (stored === '1') setSidebarCollapsed(true)
  }, [])
  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetch(`${API_BASE}/api/intern/videos`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(async (data: VideoEntry[]) => {
        if (cancelled) return
        setVideos(data)
        const fromParam = decodeSelection(searchParams.get('v'))
        let initialSel: Selection | null = fromParam
        if (!initialSel) {
          const nav = buildNav(data)
          if (nav.sommer.length > 0) {
            const first = nav.sommer[0]
            initialSel = { cat: 'SOMMER', year: first.year, day: first.days[0] ?? null, slot: null }
          } else if (nav.winter.length > 0) {
            const first = nav.winter[0]
            initialSel = { cat: 'WINTER', year: first.year, day: first.days[0] ?? null, slot: null }
          } else if (nav.weitere.length > 0) {
            initialSel = { cat: 'WEITERE', sub: nav.weitere[0] }
          }
        }
        setSelection(initialSel)

        // Direkter Link auf ein konkretes Video (?v=...&video=<youtube-id>):
        // in der Auswahl nachschlagen, ob es ein Einzelvideo ist oder in einer
        // der enthaltenen Playlists steckt, und direkt dort öffnen - anders
        // als beim normalen Durchklicken (kein Auto-Play), weil ein gezielter
        // Link genau dorthin führen soll, wohin er zeigt.
        const videoParam = searchParams.get('video')
        if (fromParam && videoParam) {
          const pool = videosForSelection(data, fromParam)
          const directHit = pool.find(v => v.type === 'VIDEO' && v.youtubeId === videoParam)
          if (directHit) {
            if (!cancelled) setWatch({ video: directHit, pool })
          } else {
            for (const entry of pool.filter(v => v.type === 'PLAYLIST')) {
              try {
                const r = await fetch(`${API_BASE}/api/intern/videos/playlist/${entry.youtubeId}`, { credentials: 'include' })
                const items: PlaylistItem[] = r.ok ? await r.json() : []
                if (items.some(i => i.videoId === videoParam)) {
                  if (!cancelled) setWatch({ video: entry, pool, startVideoId: videoParam })
                  break
                }
              } catch { /* nächste Playlist versuchen */ }
            }
          }
        }
      })
      .catch(() => setVideos([]))
      .finally(() => { if (!cancelled) setVideosLoading(false) })
    return () => { cancelled = true }
  }, [user, searchParams])

  const handleSelect = useCallback((s: Selection) => {
    setSelection(s)
    setNavOpen(false)
    setWatch(null)
    const params = new URLSearchParams()
    params.set('v', encodeSelection(s))
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [router])

  const openWatch = useCallback((video: VideoEntry, pool: VideoEntry[], startVideoId?: string) => setWatch({ video, pool, startVideoId }), [])
  const closeWatch = useCallback(() => setWatch(null), [])

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-gray-400">Laden…</div>
  if (!user) return null

  const nav = buildNav(videos)

  return (
    <div className={`mx-auto px-6 py-8 transition-all duration-300 ${theaterMode ? 'max-w-[1800px]' : 'max-w-7xl'}`}>
      {/* Page header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <Link href="/intern" className="hover:text-green-500 dark:hover:text-green-400 transition">Intern</Link>
            <span>/</span>
            <span className="text-gray-500 dark:text-gray-300">Videos</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Video-Archiv</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Konzerte & Auftritte der Schwalmtalzupfer</p>
        </div>
        {isBoard(user) && (
          <Link href="/admin?tab=videos"
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:border-green-500/40 hover:text-green-500 dark:hover:text-green-400 transition">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Videos verwalten
          </Link>
        )}
      </div>

      {/* Mobile: collapsible nav toggle */}
      <div className="mb-5 md:hidden">
        <button
          onClick={() => setNavOpen(v => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3 text-sm shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <PlaylistIcon className="h-4 w-4 text-gray-400" />
            <span className="font-medium text-gray-700 dark:text-gray-200">{selectionLabel(selection)}</span>
          </div>
          <svg className={`h-4 w-4 text-gray-400 transition-transform ${navOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {navOpen && (
          <div className="mt-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900/90 p-4 shadow-lg">
            {videosLoading
              ? <p className="text-xs text-gray-500">Lade…</p>
              : <SidebarNav nav={nav} selection={selection} onSelect={handleSelect} />
            }
          </div>
        )}
      </div>

      {/* Desktop: 2-col layout (Seitenleiste ein-/ausblendbar) */}
      <div className="flex gap-6">
        <aside className={`hidden md:block shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-12' : 'w-56'}`}>
          <div className="sticky top-28 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden">
            <button
              onClick={() => setSidebarCollapsed(v => !v)}
              title={sidebarCollapsed ? 'Archiv einblenden' : 'Archiv ausblenden'}
              className={`flex w-full items-center gap-1.5 py-3 text-gray-400 dark:text-gray-500 transition hover:text-gray-600 dark:hover:text-gray-300 ${
                sidebarCollapsed ? 'justify-center px-0' : 'justify-between border-b border-gray-100 dark:border-white/5 px-4'
              }`}
            >
              {!sidebarCollapsed && <span className="text-xs font-bold uppercase tracking-widest">Archiv</span>}
              <CollapseArrowIcon collapsed={sidebarCollapsed} className="h-3.5 w-3.5" />
            </button>
            {!sidebarCollapsed && (
              <div className="p-3">
                {videosLoading
                  ? <div className="flex flex-col gap-2">{[1,2,3,4,5,6].map(i => <div key={i} className="h-7 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />)}</div>
                  : <SidebarNav nav={nav} selection={selection} onSelect={handleSelect} />
                }
              </div>
            )}
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          {videosLoading ? (
            <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
              {[1,2,3,4,5,6].map(i => (
                <div key={i}>
                  <div className="aspect-video animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />
                  <div className="pt-3 flex flex-col gap-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-slate-800" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-slate-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : selection ? (
            <>
              {/* Section header */}
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3">
                <div className="h-7 w-1 rounded-full shrink-0 bg-green-500" />
                <span className="font-semibold text-gray-800 dark:text-white">{selectionLabel(selection)}</span>
              </div>
              {watch ? (
                // Wie bei YouTubes Playlist-Ansicht: Player + Playlist-Liste IST die
                // Übersicht, kein zusätzliches Grid mit denselben Videos darunter.
                <WatchArea key={`${watch.video.id}__${watch.startVideoId ?? ''}`} initialVideo={watch.video} pool={watch.pool} initialPlaylistVideoId={watch.startVideoId} onClose={closeWatch} theaterMode={theaterMode} onTheaterModeChange={handleTheaterModeChange} selectionParam={selection ? encodeSelection(selection) : ''} />
              ) : (
                selection.cat === 'WEITERE'
                  ? <WeitereContent videos={videos} sub={selection.sub} onOpen={openWatch} />
                  : <KonzertContent
                      videos={videos} cat={selection.cat} year={selection.year} day={selection.day} slot={selection.slot}
                      onOpen={openWatch}
                      onSelectDay={d => handleSelect({ cat: selection.cat, year: selection.year, day: d, slot: null })}
                      onSelectSlot={s => handleSelect({ cat: selection.cat, year: selection.year, day: selection.day, slot: s })}
                    />
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 gap-4 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-slate-800">
                <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-700 dark:text-gray-300">Noch keine Videos</p>
                <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Videos können im Admin-Bereich hinzugefügt werden.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default function VideosPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center text-gray-400">Laden…</div>}>
      <VideosPageInner />
    </Suspense>
  )
}
