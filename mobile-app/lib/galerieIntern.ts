import { apiFetch, API_BASE, absoluteApiUrl } from './api';

export interface GalerieFolder {
  name: string;
  prefix: string;
  coverUrl: string;
  imageCount: number;
  hasSubFolders: boolean;
}

export interface GalerieImage {
  key: string;
  url: string;
  name: string;
}

export interface GalerieBrowseResult {
  prefix: string;
  folders: GalerieFolder[];
  images: GalerieImage[];
}

export const GALERIE_INTERN_ROOT = 'galerie-intern/';

export async function browseGalerieIntern(prefix: string): Promise<GalerieBrowseResult> {
  const res = await apiFetch(`/api/galerie-intern/browse?prefix=${encodeURIComponent(prefix)}`);
  if (!res.ok) throw new Error('Galerie konnte nicht geladen werden');
  return res.json();
}

export { absoluteApiUrl };

export function thumbnailUrl(key: string): string {
  return `${API_BASE}/api/galerie-intern/thumbnail?key=${encodeURIComponent(key)}`;
}
