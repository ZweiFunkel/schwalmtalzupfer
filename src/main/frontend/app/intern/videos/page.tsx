'use client'
import { getApiBase } from '@/lib/api'
import React, { useEffect, useState, Suspense, useCallback } from 'react'
import { useAuth, isBoard } from '@/lib/auth'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const API_BASE = getApiBase()

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

type Selection =
  | { cat: 'SOMMER' | 'WINTER'; year: string; day: string | null }
  | { cat: 'WEITERE'; sub: string }

// ─── URL helpers ──────────────────────────────────────────────────────────────

function encodeSelection(s: Selection): string {
  if (s.cat === 'WEITERE') return `WEITERE__${encodeURIComponent(s.sub)}`
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

function embedUrl(v: VideoEntry, autoplay = false): string {
  const ap = autoplay ? '&autoplay=1' : ''
  if (v.type === 'PLAYLIST') return `https://www.youtube-nocookie.com/embed?listType=playlist&list=${v.youtubeId}&rel=0&modestbranding=1${ap}`
  return `https://www.youtube-nocookie.com/embed/${v.youtubeId}?rel=0&modestbranding=1${ap}`
}

function ytUrl(v: VideoEntry): string {
  if (v.type === 'PLAYLIST') return `https://www.youtube.com/playlist?list=${v.youtubeId}`
  return `https://www.youtube.com/watch?v=${v.youtubeId}`
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
  return sel.day ? `${base} ${sel.year} – ${sel.day}` : `${base} ${sel.year}`
}

function isSel(sel: Selection | null, item: Selection): boolean {
  if (!sel || sel.cat !== item.cat) return false
  if (sel.cat === 'WEITERE' && item.cat === 'WEITERE') return sel.sub === item.sub
  if (sel.cat !== 'WEITERE' && item.cat !== 'WEITERE') return sel.year === item.year && sel.day === item.day
  return false
}

// ─── Cinema Modal ─────────────────────────────────────────────────────────────

function CinemaModal({ video, onClose }: { video: VideoEntry; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-3 py-6 sm:px-6" onClick={onClose}>
      <div className="flex w-full max-w-5xl flex-col gap-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-4">
          <p className="truncate text-sm font-semibold text-white">{video.title}</p>
          <div className="flex shrink-0 items-center gap-2">
            <a href={ytUrl(video)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-gray-300 hover:border-red-500/50 hover:text-red-400 transition">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
              </svg>
              YouTube
            </a>
            <button onClick={onClose} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-gray-400 hover:border-white/40 hover:text-white transition">
              ✕ ESC
            </button>
          </div>
        </div>
        <div className="relative w-full overflow-hidden rounded-xl shadow-2xl" style={{ aspectRatio: '16/9' }}>
          <iframe className="absolute inset-0 h-full w-full" src={embedUrl(video, true)} title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowFullScreen />
        </div>
        <p className="text-center text-xs text-gray-500">
          Außen klicken oder <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono">ESC</kbd> schließt den Kinomodus · Vollbild über den YT-Player-Button
        </p>
      </div>
    </div>
  )
}

// ─── Video Card ───────────────────────────────────────────────────────────────

function VideoCard({ video }: { video: VideoEntry }) {
  const [expanded, setExpanded] = useState(false)
  const thumbnailUrl = video.thumbnailUrl
    ?? (video.type === 'VIDEO' ? `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg` : null)

  return (
    <>
      <div
        className="group cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-lg hover:border-green-500/30 transition"
        onClick={() => setExpanded(true)}
      >
        <div className="relative aspect-video overflow-hidden bg-slate-800">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailUrl} alt={video.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-800 to-slate-900">
              <svg className="h-10 w-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/>
              </svg>
              <span className="text-xs font-medium text-slate-500">Playlist</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10 transition-all duration-200 group-hover:bg-black/50">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 shadow-2xl transition-all duration-200 scale-90 opacity-70 group-hover:scale-100 group-hover:opacity-100">
              <svg className="h-6 w-6 translate-x-0.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4l15 8-15 8V4z"/>
              </svg>
            </div>
          </div>
          {video.type === 'PLAYLIST' && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/80 px-2 py-0.5 text-xs text-white">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h8"/>
              </svg>
              Playlist
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <p className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition">{video.title}</p>
          <a href={ytUrl(video)} target="_blank" rel="noopener noreferrer" title="Direkt auf YouTube"
            className="shrink-0 rounded-lg border border-white/10 p-1.5 text-gray-500 hover:border-red-500/50 hover:text-red-400 transition"
            onClick={e => e.stopPropagation()}>
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
            </svg>
          </a>
        </div>
      </div>
      {expanded && <CinemaModal video={video} onClose={() => setExpanded(false)} />}
    </>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyVideos({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 py-14 text-center">
      <span className="text-4xl">🎬</span>
      <p className="text-sm text-gray-400">{label} – noch keine Videos vorhanden.</p>
    </div>
  )
}

// ─── Content: Konzert ─────────────────────────────────────────────────────────

function KonzertContent({ videos, cat, year, day }: {
  videos: VideoEntry[]; cat: 'SOMMER' | 'WINTER'; year: string; day: string | null
}) {
  const shown = videos.filter(v =>
    v.category === cat && v.year === year && (day ? v.day === day : true)
  )
  const label = `${cat === 'SOMMER' ? 'Sommerkonzert' : 'Winterkonzert'} ${year}${day ? ` – ${day}` : ''}`
  if (shown.length === 0) return <EmptyVideos label={label} />
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {shown.map(v => <VideoCard key={v.id} video={v} />)}
    </div>
  )
}

// ─── Content: Weitere ─────────────────────────────────────────────────────────

function WeitereContent({ videos, sub }: { videos: VideoEntry[]; sub: string }) {
  const subVideos = videos
    .filter(v => v.category === 'WEITERE' && v.subcategory === sub)
    .sort((a, b) => a.position - b.position)

  if (subVideos.length === 0) return <EmptyVideos label={sub} />

  // Group by year tag; '' = no year tag
  const byYear = new Map<string, VideoEntry[]>()
  for (const v of subVideos) {
    const yr = extractYear(v.tags) ?? ''
    if (!byYear.has(yr)) byYear.set(yr, [])
    byYear.get(yr)!.push(v)
  }

  if (byYear.size <= 1) {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        {subVideos.map(v => <VideoCard key={v.id} video={v} />)}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {[...byYear.entries()]
        .sort(([a], [b]) => (b || '0').localeCompare(a || '0'))
        .map(([year, vids]) => (
          <div key={year}>
            <div className="mb-4 flex items-center gap-3">
              <span className="text-sm font-bold uppercase tracking-widest text-gray-500">{year || 'Weitere'}</span>
              <span className="flex-1 h-px bg-white/10" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {vids.map(v => <VideoCard key={v.id} video={v} />)}
            </div>
          </div>
        ))}
    </div>
  )
}

// ─── Sidebar nav ──────────────────────────────────────────────────────────────

const NAV_BTN_BASE = 'w-full rounded-lg px-3 py-1.5 text-left text-sm transition'
const NAV_BTN_ACTIVE = 'bg-green-600 text-white font-semibold'
const NAV_BTN_IDLE = 'text-gray-400 hover:bg-slate-800 hover:text-white'

function SidebarNav({ nav, selection, onSelect }: {
  nav: NavStructure
  selection: Selection | null
  onSelect: (s: Selection) => void
}) {
  function KonzertSection({ cat, label, emoji, years }: {
    cat: 'SOMMER' | 'WINTER'; label: string; emoji: string; years: KonzertNavYear[]
  }) {
    return (
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 px-1">
          <span className="text-base">{emoji}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
        </div>
        {years.length === 0 ? (
          <p className="px-2 pb-1 text-xs italic text-gray-600">Keine Videos</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {years.map(({ year, days }) =>
              days.length === 0 ? (
                <button key={year} onClick={() => onSelect({ cat, year, day: null })}
                  className={`${NAV_BTN_BASE} ${isSel(selection, { cat, year, day: null }) ? NAV_BTN_ACTIVE : NAV_BTN_IDLE}`}>
                  {year}
                </button>
              ) : (
                <div key={year}>
                  <p className="px-3 pt-1 text-xs font-semibold text-gray-500">{year}</p>
                  {days.map(day => (
                    <button key={day} onClick={() => onSelect({ cat, year, day })}
                      className={`${NAV_BTN_BASE} pl-5 flex items-center gap-1.5 ${isSel(selection, { cat, year, day }) ? NAV_BTN_ACTIVE : NAV_BTN_IDLE}`}>
                      <span className="text-[9px] opacity-50">▸</span>{day}
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <nav className="flex flex-col gap-5">
      <KonzertSection cat="SOMMER" label="Sommerkonzert" emoji="☀️" years={nav.sommer} />
      <KonzertSection cat="WINTER" label="Winterkonzert" emoji="❄️" years={nav.winter} />

      <div>
        <div className="mb-1.5 flex items-center gap-1.5 px-1">
          <span className="text-base">🎤</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Weitere Auftritte</span>
        </div>
        {nav.weitere.length === 0 ? (
          <p className="px-2 pb-1 text-xs italic text-gray-600">Keine Videos</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {nav.weitere.map(sub => (
              <button key={sub} onClick={() => onSelect({ cat: 'WEITERE', sub })}
                className={`${NAV_BTN_BASE} ${isSel(selection, { cat: 'WEITERE', sub }) ? NAV_BTN_ACTIVE : NAV_BTN_IDLE}`}>
                {sub}
              </button>
            ))}
          </div>
        )}
      </div>
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

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    fetch(`${API_BASE}/api/intern/videos`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: VideoEntry[]) => {
        setVideos(data)
        const fromParam = decodeSelection(searchParams.get('v'))
        if (fromParam) {
          setSelection(fromParam)
        } else {
          const nav = buildNav(data)
          if (nav.sommer.length > 0) {
            const first = nav.sommer[0]
            setSelection({ cat: 'SOMMER', year: first.year, day: first.days[0] ?? null })
          } else if (nav.winter.length > 0) {
            const first = nav.winter[0]
            setSelection({ cat: 'WINTER', year: first.year, day: first.days[0] ?? null })
          } else if (nav.weitere.length > 0) {
            setSelection({ cat: 'WEITERE', sub: nav.weitere[0] })
          }
        }
      })
      .catch(() => setVideos([]))
      .finally(() => setVideosLoading(false))
  }, [user, searchParams])

  const handleSelect = useCallback((s: Selection) => {
    setSelection(s)
    setNavOpen(false)
    const params = new URLSearchParams()
    params.set('v', encodeSelection(s))
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [router])

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-gray-400">Laden…</div>
  if (!user) return null

  const nav = buildNav(videos)

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/intern" className="hover:text-green-400 transition">Intern</Link>
          <span>/</span>
          <span className="text-gray-300">Videos</span>
        </div>
        {isBoard(user) && (
          <Link href="/admin?tab=videos"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-gray-400 hover:border-green-500/40 hover:text-green-400 transition">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Videos verwalten
          </Link>
        )}
      </div>

      <h1 className="mb-8 text-3xl font-bold text-white">🎬 Videos</h1>

      {/* Mobile: collapsible nav toggle */}
      <div className="mb-4 md:hidden">
        <button
          onClick={() => setNavOpen(v => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm"
        >
          <span className="font-medium text-gray-200">{selectionLabel(selection)}</span>
          <svg className={`h-4 w-4 text-gray-400 transition-transform ${navOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {navOpen && (
          <div className="mt-2 rounded-xl border border-white/10 bg-slate-900/90 p-4">
            {videosLoading
              ? <p className="text-xs text-gray-500">Lade…</p>
              : <SidebarNav nav={nav} selection={selection} onSelect={handleSelect} />
            }
          </div>
        )}
      </div>

      {/* Desktop: 2-col layout */}
      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className="hidden md:block w-52 shrink-0">
          <div className="sticky top-6 rounded-xl border border-white/10 bg-slate-900/60 p-4">
            {videosLoading
              ? <div className="flex flex-col gap-2">{[1,2,3,4,5].map(i => <div key={i} className="h-6 animate-pulse rounded bg-slate-800" />)}</div>
              : <SidebarNav nav={nav} selection={selection} onSelect={handleSelect} />
            }
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          {videosLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <div className="text-center">
                <div className="animate-pulse text-4xl">🎬</div>
                <p className="mt-3 text-sm">Lade Videos…</p>
              </div>
            </div>
          ) : selection ? (
            <>
              <h2 className="mb-6 text-base font-semibold text-gray-300">{selectionLabel(selection)}</h2>
              {selection.cat === 'WEITERE'
                ? <WeitereContent videos={videos} sub={selection.sub} />
                : <KonzertContent videos={videos} cat={selection.cat} year={selection.year} day={selection.day} />
              }
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-600">
              <span className="text-5xl">🎬</span>
              <p className="text-sm">Noch keine Videos vorhanden.</p>
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