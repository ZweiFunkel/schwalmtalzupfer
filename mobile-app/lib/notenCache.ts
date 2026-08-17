import { Directory, File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from './auth';
import { downloadUrlForKey, noteNameFromKey } from './noten';

const CACHE_INDEX_KEY = 'noten_cache_index_v1';
const notenDir = new Directory(Paths.document, 'noten');

type CacheIndex = Record<string, string>;

async function readIndex(): Promise<CacheIndex> {
  const raw = await AsyncStorage.getItem(CACHE_INDEX_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function writeIndex(index: CacheIndex): Promise<void> {
  await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
}

function localFileNameForKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9.]/g, '_');
}

export async function getCachedUri(key: string): Promise<string | null> {
  const index = await readIndex();
  const uri = index[key];
  if (!uri) return null;
  return new File(uri).exists ? uri : null;
}

export async function downloadNote(key: string): Promise<string> {
  if (!notenDir.exists) notenDir.create({ intermediates: true });

  const token = await getToken();
  const destination = new File(notenDir, localFileNameForKey(key));

  const file = await File.downloadFileAsync(downloadUrlForKey(key), destination, {
    idempotent: true,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  const index = await readIndex();
  index[key] = file.uri;
  await writeIndex(index);
  return file.uri;
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

/**
 * Alle lokal verfügbaren Noten - Grundlage für den Offline-Modus (kein Login/Internet nötig).
 */
export async function listCachedNoten(): Promise<CachedNote[]> {
  const index = await readIndex();
  const entries = await Promise.all(
    Object.entries(index).map(async ([key, uri]) => {
      const exists = new File(uri).exists;
      return exists ? { key, name: noteNameFromKey(key), uri } : null;
    })
  );
  return entries.filter((e): e is CachedNote => e !== null);
}

/**
 * Lädt mehrere Noten herunter (bereits gecachte werden übersprungen).
 * onProgress wird nach jeder Datei aufgerufen, auch bei Fehlern einzelner Dateien.
 */
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
