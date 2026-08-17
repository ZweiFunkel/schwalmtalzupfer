import { apiFetch, API_BASE } from './api';

export interface NotenBrowseResult {
  folders: string[];
  files: string[];
  prefix: string;
}

export async function browseNoten(prefix = ''): Promise<NotenBrowseResult> {
  const res = await apiFetch(`/api/noten/browse?prefix=${encodeURIComponent(prefix)}`);
  if (!res.ok) throw new Error('Noten konnten nicht geladen werden');
  return res.json();
}

export function noteNameFromKey(key: string): string {
  return key.includes('/') ? key.substring(key.lastIndexOf('/') + 1) : key;
}

export function folderNameFromPrefix(prefix: string): string {
  const trimmed = prefix.replace(/\/$/, '');
  return trimmed.includes('/') ? trimmed.substring(trimmed.lastIndexOf('/') + 1) : trimmed;
}

export function downloadUrlForKey(key: string): string {
  return `${API_BASE}/api/noten/download?key=${encodeURIComponent(key)}`;
}

export interface NoteListItem {
  key: string;
  name: string;
  size: number;
  lastModified: string;
}

export async function listAllNoten(prefix = ''): Promise<NoteListItem[]> {
  const res = await apiFetch(`/api/noten/list?prefix=${encodeURIComponent(prefix)}`);
  if (!res.ok) throw new Error('Noten konnten nicht geladen werden');
  return res.json();
}

/**
 * Liest den im Admin-Bereich (Website) konfigurierten Noten-Root-Ordner (`noten_prefix`),
 * damit die App denselben Ausschnitt des Buckets zeigt wie /noten auf der Webseite.
 */
export async function getNotenRootPrefix(): Promise<string> {
  const res = await apiFetch('/api/site/settings');
  if (!res.ok) return '';
  const data: Record<string, string> = await res.json();
  return data.noten_prefix ?? '';
}
