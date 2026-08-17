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

export interface UploadFile {
  uri: string;
  name: string;
  mimeType?: string;
}

export interface UploadResult {
  total: number;
  added: number;
  skipped: number;
  errors: number;
  addedFiles: string[];
  skippedFiles: string[];
  errorFiles: string[];
}

/** Nur für BOARD/ADMIN - selber Endpoint wie im Web-Admin. */
export async function uploadNote(prefix: string, file: UploadFile): Promise<UploadResult> {
  const form = new FormData();
  form.append('files', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType ?? 'application/octet-stream',
  } as unknown as Blob);
  form.append('prefix', prefix);

  const res = await apiFetch('/api/noten/upload', { method: 'POST', body: form });
  if (!res.ok) throw new Error('Upload fehlgeschlagen');
  return res.json();
}
