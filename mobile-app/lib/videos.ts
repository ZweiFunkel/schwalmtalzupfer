import { useEffect, useState } from 'react';
import { apiFetch, absoluteApiUrl } from './api';

export interface VideoEntry {
  id: string;
  category: 'SOMMER' | 'WINTER' | 'WEITERE';
  year: string | null;
  day: string | null;
  subcategory: string | null;
  /** JSON-Array als String (z.B. '["2024"]'), wird bei "Weitere Auftritte" zur Jahresgruppierung genutzt. */
  tags?: string | null;
  type: 'VIDEO' | 'PLAYLIST';
  youtubeId: string;
  title: string;
  thumbnailUrl: string | null;
  position: number;
}

export async function fetchVideos(): Promise<VideoEntry[]> {
  const res = await apiFetch('/api/intern/videos');
  if (!res.ok) throw new Error('Videos konnten nicht geladen werden');
  return res.json();
}

export function thumbnailFor(v: VideoEntry): string | null {
  // v.thumbnailUrl kann ein relativer R2-Fallback-Pfad sein (siehe absoluteApiUrl) -
  // RN Image lädt sowas anders als ein Browser-<img> nicht automatisch gegen die eigene
  // Origin auf, sondern zeigt einfach nichts an.
  const raw = v.thumbnailUrl ?? (v.type === 'VIDEO' ? `https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg` : null);
  return raw ? absoluteApiUrl(raw) : null;
}

export function watchUrl(v: VideoEntry): string {
  return v.type === 'PLAYLIST'
    ? `https://www.youtube.com/playlist?list=${v.youtubeId}`
    : `https://www.youtube.com/watch?v=${v.youtubeId}`;
}

export interface PlaylistItem {
  videoId: string;
  title: string;
  thumbnail: string;
}

// Playlist-Inhalte werden an mehreren Stellen gleichzeitig gebraucht (Tages-Kachel,
// Playlist-Abschnitt in der Übersicht, Player) - ein gemeinsamer Cache verhindert, dass
// dieselbe Playlist beim Durchklicken immer wieder neu vom Server geholt wird.
const playlistCache = new Map<string, Promise<PlaylistItem[]>>();

/** Einzelne Videos einer Playlist, gleicher Endpoint wie im Web (WatchArea). Liefert bei Fehlern []. */
export function fetchPlaylistItems(youtubeId: string): Promise<PlaylistItem[]> {
  const cached = playlistCache.get(youtubeId);
  if (cached) return cached;
  const promise = apiFetch(`/api/intern/videos/playlist/${youtubeId}`)
    .then(res => (res.ok ? res.json() : []))
    .then((items: PlaylistItem[]) => (Array.isArray(items) ? items : []))
    .catch(() => [] as PlaylistItem[]);
  // Leere/fehlgeschlagene Antworten nicht dauerhaft merken, damit ein späterer Versuch klappen kann.
  promise.then(items => { if (items.length === 0) playlistCache.delete(youtubeId); });
  playlistCache.set(youtubeId, promise);
  return promise;
}

export function clearPlaylistCache() {
  playlistCache.clear();
}

/** null = lädt noch, [] = leer bzw. nicht ladbar. */
export function usePlaylistItems(youtubeId: string | null): PlaylistItem[] | null {
  const [items, setItems] = useState<PlaylistItem[] | null>(null);
  useEffect(() => {
    if (!youtubeId) { setItems(null); return; }
    let cancelled = false;
    setItems(null);
    fetchPlaylistItems(youtubeId).then(list => { if (!cancelled) setItems(list); });
    return () => { cancelled = true; };
  }, [youtubeId]);
  return items;
}

/**
 * HTML-Seite mit der echten YouTube-IFrame-Player-API (statt einer rohen Embed-URL) - nur so
 * lässt sich ein onError/onStateChange-Event abfangen und eine eigene Fehleroberfläche statt
 * YouTubes rohem Fehlerbildschirm anzeigen (Code 101/150 = Einbettung deaktiviert, 153 = auf
 * diese Domain beschränkt). Muss mit baseUrl der echten Domain geladen werden (siehe WebView-
 * Aufruf), sonst schlagen auf bestimmte Domains beschränkte Embeds grundsätzlich fehl, weil eine
 * lokal geladene HTML-Seite sonst keinen erkennbaren Origin hat.
 *
 * width/height werden bewusst von React Native aus vorgegeben (statt sie per
 * document.documentElement.clientWidth/Height innerhalb der WebView zu messen) - dieses Messen
 * lief bei der geteilten Ansicht (Video + Playlist-Liste darunter) offenbar zu früh, bevor die
 * WebView ihre endgültige, per aspectRatio berechnete Höhe hatte, wodurch das Video seitlich
 * abgeschnitten wurde. Feste, von RN übergebene Pixelwerte umgehen dieses Timing-Problem.
 */
function playerHtmlTemplate(topLevel: string, listVars: string, width: number, height: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <style>html,body{margin:0;padding:0;background:#000;overflow:hidden;}
  /* KEIN width/height:100% hier - das würde die von React Native vorgegebenen Pixelmaße
     unten sofort wieder überschreiben und exakt das Zuschneide-Problem zurückbringen, das
     diese festen Maße eigentlich beheben sollen. Das Video bekommt seine Größe ausschließlich
     über die width/height-Parameter, die new YT.Player() unten übergeben werden. */
  #player{position:absolute;top:0;left:0;}</style>
</head>
<body>
  <div id="player"></div>
  <script>
    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
    function onYouTubeIframeAPIReady() {
      var player = new YT.Player('player', {
        height: '${Math.round(height)}',
        width: '${Math.round(width)}',
        ${topLevel}
        playerVars: { ${listVars} autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onError: function(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', code: e.data }));
          },
          onStateChange: function(e) {
            if (e.data === 0) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ended' }));
          }
        }
      });
    }
  </script>
</body>
</html>`;
}

/** Player für ein einzelnes Video (auch für das jeweils aktuelle Video innerhalb einer Playlist). */
export function buildVideoPlayerHtml(videoId: string, width: number, height: number): string {
  return playerHtmlTemplate(`videoId: '${videoId}',`, '', width, height);
}

/**
 * Fallback, falls die Playlist-API keine Items liefert (z.B. fehlender YouTube-API-Key auf dem
 * Server) - direkt die YouTube-Playlist als Embed laden. Hier ist keine Item-für-Item-Navigation
 * möglich, nur YouTubes eigene, eingebaute Playlist-Steuerung innerhalb des Players.
 */
export function buildPlaylistEmbedHtml(playlistId: string, width: number, height: number): string {
  return playerHtmlTemplate('', `listType: 'playlist', list: '${playlistId}',`, width, height);
}

// ─── Archiv-Struktur (identisch zur Webseite /intern/videos) ─────────────────

export const DAYS_ORDER = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

// Zeitabschnitte (z.B. Sonntag Morgen/Abend) sind Freitext in subcategory - bekannte Begriffe
// chronologisch, unbekannte danach alphabetisch (wie im Web).
const TIME_SLOT_ORDER = ['Morgen', 'Vormittag', 'Mittag', 'Nachmittag', 'Abend', 'Nacht'];

export function sortSlots(slots: string[]): string[] {
  return [...slots].sort((a, b) => {
    const ia = TIME_SLOT_ORDER.indexOf(a);
    const ib = TIME_SLOT_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? TIME_SLOT_ORDER.length : ia) - (ib === -1 ? TIME_SLOT_ORDER.length : ib);
    return a.localeCompare(b);
  });
}

export function extractYearTag(tags: string | null | undefined): string | null {
  if (!tags) return null;
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.find((t: unknown) => typeof t === 'string' && /^\d{4}$/.test(t)) ?? null : null;
  } catch {
    return null;
  }
}

export interface KonzertNavYear { year: string; days: string[] }
export interface NavStructure { sommer: KonzertNavYear[]; winter: KonzertNavYear[]; weitere: string[] }

export function buildNav(videos: VideoEntry[]): NavStructure {
  function konzertYears(cat: 'SOMMER' | 'WINTER'): KonzertNavYear[] {
    const catVids = videos.filter(v => v.category === cat);
    const years = [...new Set(catVids.map(v => v.year).filter(Boolean) as string[])].sort((a, b) => b.localeCompare(a));
    return years.map(year => ({
      year,
      days: DAYS_ORDER.filter(d => catVids.some(v => v.year === year && v.day === d)),
    }));
  }
  return {
    sommer: konzertYears('SOMMER'),
    winter: konzertYears('WINTER'),
    weitere: [...new Set(videos.filter(v => v.category === 'WEITERE').map(v => v.subcategory).filter(Boolean) as string[])],
  };
}

export type Selection =
  | { cat: 'SOMMER' | 'WINTER'; year: string; day: string | null; slot: string | null }
  | { cat: 'WEITERE'; sub: string };

export function defaultSelection(nav: NavStructure): Selection | null {
  if (nav.sommer.length > 0) return { cat: 'SOMMER', year: nav.sommer[0].year, day: null, slot: null };
  if (nav.winter.length > 0) return { cat: 'WINTER', year: nav.winter[0].year, day: null, slot: null };
  if (nav.weitere.length > 0) return { cat: 'WEITERE', sub: nav.weitere[0] };
  return null;
}

/** Prüft, ob eine (z.B. vor dem Neuladen gemerkte) Auswahl in den aktuellen Daten noch existiert. */
export function selectionStillValid(nav: NavStructure, sel: Selection): boolean {
  if (sel.cat === 'WEITERE') return nav.weitere.includes(sel.sub);
  const years = sel.cat === 'SOMMER' ? nav.sommer : nav.winter;
  const y = years.find(x => x.year === sel.year);
  if (!y) return false;
  return sel.day === null || y.days.includes(sel.day);
}

export function categoryLabel(cat: VideoEntry['category']): string {
  return cat === 'SOMMER' ? 'Sommerkonzert' : cat === 'WINTER' ? 'Winterkonzert' : 'Weitere Auftritte';
}

export function selectionLabel(sel: Selection): string {
  if (sel.cat === 'WEITERE') return sel.sub;
  let label = `${categoryLabel(sel.cat)} ${sel.year}`;
  if (sel.day) label += ` – ${sel.day}`;
  if (sel.slot) label += ` (${sel.slot})`;
  return label;
}
