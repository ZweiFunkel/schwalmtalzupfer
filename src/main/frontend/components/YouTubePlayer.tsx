'use client'
import React, { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

// ─── YouTube IFrame API onError-Codes ────────────────────────────────────────
// 2   = Ungültiger Parameter (z.B. falsche Video-ID)
// 5   = HTML5-Player-Fehler
// 100 = Video nicht gefunden, gelöscht oder privat
// 101 / 150 = Einbettung vom Rechteinhaber gesperrt ("embedding disabled")
function isEmbedDisabledCode(code: number): boolean {
  return code === 101 || code === 150
}

function errorMessage(code: number): string {
  switch (code) {
    case 2:
      return 'Ungültige Video-ID.'
    case 5:
      return 'Der Player konnte das Video nicht abspielen (HTML5-Fehler).'
    case 100:
      return 'Dieses Video wurde nicht gefunden, gelöscht oder ist privat.'
    case 101:
    case 150:
      return 'Der Rechteinhaber hat die Einbettung dieses Videos auf anderen Webseiten gesperrt.'
    default:
      return 'Das Video konnte nicht geladen werden.'
  }
}

interface YouTubePlayerProps {
  videoId: string
  /** Titel für den Fallback-Hinweis, wenn die Einbettung gesperrt ist */
  title?: string
  /** Thumbnail für den Fallback-Hinweis (gedimmter Hintergrund) */
  thumbnailUrl?: string | null
  onReady?: (player: any) => void
  onStateChange?: (event: any) => void
  /** Wird aufgerufen, sobald das Video zu Ende gespielt wurde (z.B. für Playlist-Autoplay) */
  onEnded?: () => void
  autoplay?: boolean
  className?: string
}

/**
 * Wrapper um die YouTube-IFrame-Player-API.
 *
 * Nutzt bewusst die native YouTube-Bedienoberfläche (controls: 1) statt eines
 * selbstgebauten Scrubbers – dadurch bekommen Nutzer:innen automatisch
 * Tastatursteuerung, Untertitel, Qualitätswahl und Vollbild "geschenkt".
 *
 * Der Mehrwert dieser Komponente gegenüber einem rohen <iframe>: Über die
 * onError-Events der JS-API lässt sich erkennen, wenn ein Video vom
 * Rechteinhaber für die Einbettung gesperrt wurde (Codes 101/150). Ein rohes
 * <iframe src="..."> feuert dafür NICHT das DOM-onerror-Event – YouTube
 * rendert stattdessen nur eine hässliche Fehlermeldung innerhalb des Frames.
 * Hier fangen wir diesen Fall ab und zeigen stattdessen einen eigenen,
 * themenfähigen Hinweis mit Link zu YouTube.
 */
export default function YouTubePlayer({
  videoId,
  title,
  thumbnailUrl,
  onReady,
  onStateChange,
  onEnded,
  autoplay = false,
  className = '',
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const elementIdRef = useRef(`yt-player-${Math.random().toString(36).slice(2, 11)}`)
  const [error, setError] = useState<{ code: number; message: string } | null>(null)

  // Hinweis: Diese Komponente initialisiert den Player nur EINMAL pro Mount.
  // Zum Wechseln des Videos (z.B. beim Weiterklicken in einer Playlist) muss
  // der Aufrufer `key={videoId}` setzen, damit React sauber neu montiert –
  // die YT-API ersetzt beim Erstellen das Container-Element durch ein
  // <iframe>, ein erneutes `new YT.Player()` auf derselben (dann nicht mehr
  // existierenden) Element-ID würde sonst fehlschlagen.
  useEffect(() => {
    if (!videoId || videoId.trim() === '') return

    let cancelled = false
    let poll: ReturnType<typeof setTimeout> | null = null
    setError(null)

    function initPlayer() {
      if (cancelled) return
      if (!window.YT || !window.YT.Player) {
        poll = setTimeout(initPlayer, 100)
        return
      }
      if (!containerRef.current) return

      try {
        playerRef.current = new window.YT.Player(elementIdRef.current, {
          videoId,
          // Privacy-enhanced mode: weniger Tracking, bessere Kompatibilität
          // mit Brave/Firefox-Schutz und strengen Cookie-Einstellungen.
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            autoplay: autoplay ? 1 : 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            origin: typeof window !== 'undefined' ? window.location.origin : '',
          },
          events: {
            onReady: (event: any) => {
              if (onReady) onReady(event.target)
            },
            onStateChange: (event: any) => {
              if (onStateChange) onStateChange(event)
              if (window.YT?.PlayerState && event.data === window.YT.PlayerState.ENDED && onEnded) {
                onEnded()
              }
            },
            onError: (event: any) => {
              const code = typeof event?.data === 'number' ? event.data : -1
              console.error(`YouTube-Player-Fehler (Code ${code}) für Video ${videoId}`)
              setError({ code, message: errorMessage(code) })
            },
          },
        })
      } catch (e) {
        console.error('Fehler beim Erstellen des YouTube-Players:', e)
      }
    }

    initPlayer()

    return () => {
      cancelled = true
      if (poll) clearTimeout(poll)
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy()
        } catch {
          // Player war bereits zerstört/nicht initialisiert – ignorieren
        }
      }
      playerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  if (!videoId) return null

  // Der Container-Div unten wird von YouTubes Player-API intern gegen ein <iframe>
  // ausgetauscht, sobald new YT.Player(...) läuft - React weiß davon nichts. Würde React
  // diesen Div bei einem Fehler aus dem Baum entfernen (z.B. durch ein bedingtes Return),
  // crasht die Reconciliation mit "removeChild: The node to be removed is not a child of
  // this node", weil der von React erwartete Knoten längst durch das <iframe> ersetzt ist.
  // Deshalb bleibt der Container IMMER gemountet; die Fehleranzeige legt sich nur optisch
  // (via CSS) als zusätzliches Overlay darüber, React entfernt dabei nie den YT-Knoten selbst.
  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        id={elementIdRef.current}
        className="absolute inset-0 h-full w-full"
        style={error ? { visibility: 'hidden' } : undefined}
      />
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-hidden bg-gray-100 dark:bg-slate-900 px-6 py-10 text-center">
          {thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-20 blur-sm" />
          )}
          <div className="relative flex max-w-md flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/10">
              <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            {title && <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</p>}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isEmbedDisabledCode(error.code)
                ? 'Video nicht verfügbar – der Rechteinhaber hat die Einbettung dieses Videos außerhalb von YouTube gesperrt.'
                : error.message}
            </p>
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-500"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
              </svg>
              Auf YouTube ansehen
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
