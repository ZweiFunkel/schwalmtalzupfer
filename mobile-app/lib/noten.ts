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

export async function listAllNoten(): Promise<NoteListItem[]> {
  const res = await apiFetch('/api/noten/list');
  if (!res.ok) throw new Error('Noten konnten nicht geladen werden');
  return res.json();
}
