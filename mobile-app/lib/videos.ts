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

export function embedUrl(v: VideoEntry): string {
  if (v.type === 'PLAYLIST') {
    return `https://www.youtube-nocookie.com/embed/videoseries?list=${v.youtubeId}&rel=0&modestbranding=1&autoplay=1`;
  }
  return `https://www.youtube-nocookie.com/embed/${v.youtubeId}?rel=0&modestbranding=1&autoplay=1&playsinline=1`;
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
