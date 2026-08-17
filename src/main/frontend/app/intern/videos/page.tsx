'use client'
import { getApiBase } from '@/lib/api'
import React, { useEffect, useState, Suspense, useCallback } from 'react'
import { useAuth, isBoard } from '@/lib/auth'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import YouTubePlayer from '@/components/YouTubePlayer'

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

interface PlaylistItem {
  videoId: string
  title: string
  thumbnail: string
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
  return sel.day ? `${base} ${sel.year} – ${sel.day}` : `${base} ${sel.year}`
}

function isSel(sel: Selection | null, item: Selection): boolean {
  if (!sel || sel.cat !== item.cat) return false
  if (sel.cat === 'WEITERE' && item.cat === 'WEITERE') return sel.sub === item.sub
  if (sel.cat !== 'WEITERE' && item.cat !== 'WEITERE') return sel.year === item.year && sel.day === item.day
  return false
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

function PlaylistShelf({ playlists, onOpen }: { playlists: VideoEntry[]; onOpen: (v: VideoEntry) => void }) {
  if (playlists.length === 0) return null
  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <PlaylistIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Playlists</h3>
      </div>
      <div className="-mx-1 flex gap-5 overflow-x-auto px-1 pb-3">
        {playlists.map(v => (
          <div key={v.id} className="w-52 shrink-0 sm:w-56">
            <VideoCard video={v} onOpen={onOpen} />
          </div>
        ))}
      </div>
    </div>
  )
}

function SplitVideos({ items, onOpen }: { items: VideoEntry[]; onOpen: (v: VideoEntry) => void }) {
  const playlists = items.filter(v => v.type === 'PLAYLIST')
  const singles = items.filter(v => v.type === 'VIDEO')
  return (
    <div>
      <PlaylistShelf playlists={playlists} onOpen={onOpen} />
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

// ─── Theater-Ansicht (großes Kino/Watch-Page-artiges Overlay) ───────────────

function TheaterOverlay({
  initialVideo, pool, onClose,
}: {
  initialVideo: VideoEntry
  pool: VideoEntry[]
  onClose: () => void
}) {
  const [activeVideo, setActiveVideo] = useState(initialVideo)
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([])
  const [playlistLoading, setPlaylistLoading] = useState(initialVideo.type === 'PLAYLIST')
  const [currentVideoId, setCurrentVideoId] = useState(activeVideo.type === 'VIDEO' ? activeVideo.youtubeId : '')
  const [showSidebar, setShowSidebar] = useState(true)

  // ESC schließt, Hintergrund-Scroll sperren (wie Lightbox)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [onClose])

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
        if (items.length > 0) setCurrentVideoId(items[0].videoId)
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
    setShowSidebar(true)
  }

  const related = pool.filter(v => v.id !== activeVideo.id)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white/97 dark:bg-black/97 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-200 dark:border-white/10 bg-white/90 dark:bg-black/80 px-4 py-3 backdrop-blur sm:px-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white"
            aria-label="Schließen"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <p className="truncate text-sm font-semibold text-gray-800 dark:text-white">{currentTitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setShowSidebar(v => !v)}
            className={`hidden items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition lg:flex ${
              showSidebar
                ? 'border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400'
                : 'border-gray-200 dark:border-white/15 text-gray-500 dark:text-gray-400 hover:border-green-500/40 hover:text-green-600 dark:hover:text-green-400'
            }`}
          >
            <PlaylistIcon className="h-3.5 w-3.5" />
            Seitenleiste
          </button>
          <a
            href={currentVideoId ? `https://www.youtube.com/watch?v=${currentVideoId}` : ytUrl(activeVideo)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/15 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 transition hover:border-red-400 hover:text-red-500 dark:hover:text-red-400"
          >
            <YouTubeIcon />
            YouTube
          </a>
          <span className="hidden text-xs text-gray-400 dark:text-gray-500 sm:inline">
            <kbd className="rounded border border-gray-300 dark:border-white/20 px-1.5 py-0.5 font-mono">ESC</kbd> schließt
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        className={`mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 sm:px-6 ${showSidebar ? 'max-w-[1600px] lg:flex-row' : 'max-w-[1280px]'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Player-Spalte */}
        <div className="min-w-0 flex-1">
          <div className="relative w-full overflow-hidden rounded-xl bg-black shadow-2xl" style={{ aspectRatio: '16/9' }}>
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
                key={currentVideoId}
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
          <div className="mt-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{currentTitle}</h2>
            {isPlaylist && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Playlist · {activeVideo.title}</p>
            )}
          </div>
        </div>

        {/* Seitenleiste: Playlist-Queue + Weitere Videos */}
        {showSidebar && (
          <div className="w-full shrink-0 lg:w-[380px]">
            {isPlaylist && (
              <div className="mb-6">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Playlist</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{playlistItems.length} Videos</span>
                </div>
                <div className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-2">
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
            )}

            {related.length > 0 && (
              <div>
                <span className="mb-3 block text-sm font-semibold text-gray-700 dark:text-gray-200">Weitere Videos</span>
                <div className="flex flex-col gap-2">
                  {related.map(v => {
                    const thumb = thumbnailFor(v)
                    return (
                      <button
                        key={v.id}
                        onClick={() => switchTo(v)}
                        className="flex gap-2 rounded-lg p-1.5 text-left transition hover:bg-gray-100 dark:hover:bg-white/10"
                      >
                        <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-200 dark:bg-slate-800">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumb} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <PlaylistIcon className="h-5 w-5 text-gray-400 dark:text-slate-600" />
                            </div>
                          )}
                          {v.type === 'PLAYLIST' && (
                            <div className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[9px] font-medium text-white">
                              Playlist
                            </div>
                          )}
                        </div>
                        <p className="min-w-0 flex-1 line-clamp-2 text-xs font-medium text-gray-700 dark:text-gray-200">{v.title}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
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

function KonzertContent({ videos, cat, year, day, onOpen }: {
  videos: VideoEntry[]; cat: 'SOMMER' | 'WINTER'; year: string; day: string | null
  onOpen: (v: VideoEntry, pool: VideoEntry[]) => void
}) {
  const shown = videos.filter(v =>
    v.category === cat && v.year === year && (day ? v.day === day : true)
  )
  const label = `${cat === 'SOMMER' ? 'Sommerkonzert' : 'Winterkonzert'} ${year}${day ? ` – ${day}` : ''}`
  if (shown.length === 0) return <EmptyVideos label={label} />
  return <SplitVideos items={shown} onOpen={v => onOpen(v, shown)} />
}

// ─── Content: Weitere ─────────────────────────────────────────────────────────

function WeitereContent({ videos, sub, onOpen }: {
  videos: VideoEntry[]; sub: string
  onOpen: (v: VideoEntry, pool: VideoEntry[]) => void
}) {
  const subVideos = videos
    .filter(v => v.category === 'WEITERE' && v.subcategory === sub)
    .sort((a, b) => a.position - b.position)

  if (subVideos.length === 0) return <EmptyVideos label={sub} />

  const handleOpen = (v: VideoEntry) => onOpen(v, subVideos)

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

function NavItem({ active, onClick, children, indent = false }: {
  active: boolean; onClick: () => void; children: React.ReactNode; indent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-sm transition-all duration-150 rounded-lg px-3 py-1.5 flex items-center gap-2 ${indent ? 'pl-5' : ''}
        ${active
          ? 'bg-green-600 text-white font-semibold shadow-sm shadow-green-700/20'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
        }`}
    >
      {children}
    </button>
  )
}

function SidebarSection({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5 px-1">
        <span className={`h-2 w-2 rounded-full shrink-0 ${color}`} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</span>
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
  function KonzertSection({ cat, label, color, years }: {
    cat: 'SOMMER' | 'WINTER'; label: string; color: string; years: KonzertNavYear[]
  }) {
    return (
      <SidebarSection label={label} color={color}>
        {years.length === 0 ? (
          <p className="px-2 pb-1 text-xs italic text-gray-400 dark:text-gray-600">Keine Videos</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {years.map(({ year, days }) =>
              days.length === 0 ? (
                <NavItem key={year} active={isSel(selection, { cat, year, day: null })} onClick={() => onSelect({ cat, year, day: null })}>
                  {year}
                </NavItem>
              ) : (
                <div key={year}>
                  <NavItem active={isSel(selection, { cat, year, day: null })} onClick={() => onSelect({ cat, year, day: null })}>
                    <span className="font-medium">{year}</span>
                    <span className="ml-auto text-[10px] opacity-60">{days.length}d</span>
                  </NavItem>
                  <div className="relative ml-3 mt-0.5 mb-1 flex flex-col gap-0.5">
                    <div className="absolute left-0 top-1 bottom-1 w-px bg-gray-200 dark:bg-white/10" />
                    {days.map(day => (
                      <NavItem key={day} active={isSel(selection, { cat, year, day })} onClick={() => onSelect({ cat, year, day })} indent>
                        {day}
                      </NavItem>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </SidebarSection>
    )
  }

  return (
    <nav className="flex flex-col gap-5">
      <KonzertSection cat="SOMMER" label="Sommerkonzert" color="bg-amber-400" years={nav.sommer} />
      <KonzertSection cat="WINTER" label="Winterkonzert" color="bg-sky-400" years={nav.winter} />

      <SidebarSection label="Weitere Auftritte" color="bg-purple-400">
        {nav.weitere.length === 0 ? (
          <p className="px-2 pb-1 text-xs italic text-gray-400 dark:text-gray-600">Keine Videos</p>
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
  const [theater, setTheater] = useState<{ video: VideoEntry; pool: VideoEntry[] } | null>(null)

  useEffect(() => { document.title = 'Videos – Schwalmtalzupfer' }, [])

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

  const openTheater = useCallback((video: VideoEntry, pool: VideoEntry[]) => setTheater({ video, pool }), [])
  const closeTheater = useCallback(() => setTheater(null), [])

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-gray-400">Laden…</div>
  if (!user) return null

  const nav = buildNav(videos)

  const catColor = selection
    ? selection.cat === 'SOMMER' ? 'from-amber-500/10 to-transparent border-amber-200 dark:border-amber-500/20'
    : selection.cat === 'WINTER' ? 'from-sky-500/10 to-transparent border-sky-200 dark:border-sky-500/20'
    : 'from-purple-500/10 to-transparent border-purple-200 dark:border-purple-500/20'
    : 'from-gray-100 to-transparent border-gray-200 dark:from-white/5 dark:border-white/10'

  const catAccent = selection
    ? selection.cat === 'SOMMER' ? 'bg-amber-400'
    : selection.cat === 'WINTER' ? 'bg-sky-400'
    : 'bg-purple-400'
    : 'bg-gray-300'

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
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
            <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${catAccent}`} />
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

      {/* Desktop: 2-col layout */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="hidden md:block w-56 shrink-0">
          <div className="sticky top-28 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 dark:border-white/5 px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">Archiv</span>
            </div>
            <div className="p-3">
              {videosLoading
                ? <div className="flex flex-col gap-2">{[1,2,3,4,5,6].map(i => <div key={i} className="h-7 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />)}</div>
                : <SidebarNav nav={nav} selection={selection} onSelect={handleSelect} />
              }
            </div>
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
              <div className={`mb-6 flex items-center gap-3 rounded-xl border bg-gradient-to-r px-4 py-3 ${catColor}`}>
                <div className={`h-7 w-1 rounded-full shrink-0 ${catAccent}`} />
                <span className="font-semibold text-gray-800 dark:text-white">{selectionLabel(selection)}</span>
              </div>
              {selection.cat === 'WEITERE'
                ? <WeitereContent videos={videos} sub={selection.sub} onOpen={openTheater} />
                : <KonzertContent videos={videos} cat={selection.cat} year={selection.year} day={selection.day} onOpen={openTheater} />
              }
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

      {theater && (
        <TheaterOverlay initialVideo={theater.video} pool={theater.pool} onClose={closeTheater} />
      )}
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
