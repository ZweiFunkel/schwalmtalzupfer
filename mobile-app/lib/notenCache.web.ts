import { getToken } from './auth';
import { downloadUrlForKey, noteNameFromKey } from './noten';

// Web-Variante des Noten-Caches: statt Dateien im Gerätespeicher liegen die heruntergeladenen
// Noten als Blobs in der IndexedDB des Browsers (offline nutzbar, solange der Browser-Speicher
// nicht geleert wird). Die "URI" einer Note ist hier eine blob:-URL.

const DB_NAME = 'zupfer-noten';
const STORE = 'files';

interface StoredNote {
  blob: Blob;
  savedAt: number;
}

export interface WebDirectory {
  uri: string;
}

const BROWSER_DIR: WebDirectory = { uri: 'browser://noten' };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

const urlCache = new Map<string, string>();

function urlFor(key: string, blob: Blob): string {
  const existing = urlCache.get(key);
  if (existing) return existing;
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

export function defaultNotenDir(): WebDirectory {
  return BROWSER_DIR;
}

export async function getNotenLocalDirUri(): Promise<string | null> {
  return null;
}

export async function getNotenDir(): Promise<WebDirectory> {
  return BROWSER_DIR;
}

export function prettyDirLabel(): string {
  return 'Browser-Speicher dieses Geräts';
}

export async function pickNotenDir(): Promise<WebDirectory | null> {
  return null;
}

export async function setCustomNotenDir(): Promise<void> {}

export async function resetNotenDirToDefault(): Promise<void> {}

export async function moveCachedNotesToCurrentDir(): Promise<number> {
  return 0;
}

export async function getCachedUri(key: string): Promise<string | null> {
  const stored = await withStore<StoredNote | undefined>('readonly', s => s.get(key));
  return stored ? urlFor(key, stored.blob) : null;
}

export async function downloadNote(key: string): Promise<string> {
  const token = await getToken();
  const res = await fetch(downloadUrlForKey(key), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error('Note konnte nicht geladen werden');
  const blob = await res.blob();
  await withStore('readwrite', s => s.put({ blob, savedAt: Date.now() } satisfies StoredNote, key));
  urlCache.delete(key);
  return urlFor(key, blob);
}

export async function ensureNoteAvailable(key: string): Promise<string> {
  const cached = await getCachedUri(key);
  if (cached) return cached;
  return downloadNote(key);
}

export interface CachedNote {
  key: string;
  name: string;
  uri: string;
}

export async function listCachedNoten(): Promise<CachedNote[]> {
  const keys = (await withStore<IDBValidKey[]>('readonly', s => s.getAllKeys())).map(String);
  const notes = await Promise.all(
    keys.map(async key => {
      const uri = await getCachedUri(key);
      return uri ? { key, name: noteNameFromKey(key), uri } : null;
    })
  );
  return notes.filter((n): n is CachedNote => n !== null);
}

export async function downloadMany(
  keys: string[],
  onProgress?: (done: number, total: number) => void
): Promise<{ succeeded: string[]; failed: string[] }> {
  const succeeded: string[] = [];
  const failed: string[] = [];
  for (let i = 0; i < keys.length; i++) {
    try {
      await ensureNoteAvailable(keys[i]);
      succeeded.push(keys[i]);
    } catch {
      failed.push(keys[i]);
    }
    onProgress?.(i + 1, keys.length);
  }
  return { succeeded, failed };
}
