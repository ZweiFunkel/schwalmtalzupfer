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

/**
 * HTML-Seite mit der echten YouTube-IFrame-Player-API (statt einer rohen Embed-URL) - nur so
 * lässt sich ein onError-Event abfangen und eine eigene Fehleroberfläche statt YouTubes rohem
 * Fehlerbildschirm anzeigen (Code 101/150 = Embedding deaktiviert, 153 = auf diese Domain
 * beschränkt). Muss mit baseUrl der echten Domain geladen werden (siehe WebView-Aufruf), sonst
 * schlagen auf bestimmte Domains beschränkte Embeds (Code 153) grundsätzlich fehl, weil eine
 * lokal geladene HTML-Seite sonst keinen erkennbaren Origin hat.
 */
export function buildPlayerHtml(v: VideoEntry): string {
  // videoId gehört auf die oberste Ebene, listType/list dagegen MÜSSEN in playerVars stecken -
  // beides auf derselben Ebene zu mischen ergibt für die IFrame-API einen ungültigen Aufruf
  // (Fehlercode 2 "invalid parameter"), keinen echten Einbettungsfehler.
  const topLevel = v.type === 'PLAYLIST' ? '' : `videoId: '${v.youtubeId}',`;
  const listVars = v.type === 'PLAYLIST' ? `listType: 'playlist', list: '${v.youtubeId}',` : '';
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden;}
  #player{position:absolute;top:0;left:0;width:100%;height:100%;}</style>
</head>
<body>
  <div id="player"></div>
  <script>
    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
    function onYouTubeIframeAPIReady() {
      new YT.Player('player', {
        ${topLevel}
        playerVars: { ${listVars} autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onError: function(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', code: e.data }));
          }
        }
      });
    }
  </script>
</body>
</html>`;
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
