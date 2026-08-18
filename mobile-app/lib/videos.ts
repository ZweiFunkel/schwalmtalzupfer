import { apiFetch } from './api';

export interface VideoEntry {
  id: string;
  category: 'SOMMER' | 'WINTER' | 'WEITERE';
  year: string | null;
  day: string | null;
  subcategory: string | null;
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
  return v.thumbnailUrl ?? (v.type === 'VIDEO' ? `https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg` : null);
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

/** Einzelne Videos einer Playlist, gleicher Endpoint wie im Web (WatchArea). */
export async function fetchPlaylistItems(youtubeId: string): Promise<PlaylistItem[]> {
  const res = await apiFetch(`/api/intern/videos/playlist/${youtubeId}`);
  if (!res.ok) return [];
  return res.json();
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

const DAYS_ORDER = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

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
