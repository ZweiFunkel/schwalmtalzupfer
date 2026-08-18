import { Directory, File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from './auth';
import { downloadUrlForKey, noteNameFromKey } from './noten';

const CACHE_INDEX_KEY = 'noten_cache_index_v1';
const LOCAL_DIR_KEY = 'noten_local_dir_uri_v1';

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

/** Eingebauter Standard-Speicherort (App-interner Bereich, immer verfügbar, kein Berechtigungsdialog nötig). */
export function defaultNotenDir(): Directory {
  return new Directory(Paths.document, 'noten');
}

/** Vom Nutzer per Ordnerauswahl-Dialog gewählter, abweichender Speicherort (falls gesetzt). */
export async function getNotenLocalDirUri(): Promise<string | null> {
  return AsyncStorage.getItem(LOCAL_DIR_KEY);
}

async function setNotenLocalDirUri(uri: string | null): Promise<void> {
  if (uri) await AsyncStorage.setItem(LOCAL_DIR_KEY, uri);
  else await AsyncStorage.removeItem(LOCAL_DIR_KEY);
}

/** Aktuell aktiver lokaler Noten-Ordner (Standard, sofern kein eigener Ordner gewählt wurde). */
export async function getNotenDir(): Promise<Directory> {
  const customUri = await getNotenLocalDirUri();
  return customUri ? new Directory(customUri) : defaultNotenDir();
}

/**
 * Möglichst lesbare Kurzform eines Ordner-Pfads für die Anzeige in den Einstellungen - eine
 * SAF-content://-URI (Android-Ordnerauswahl) ist sonst nur eine kryptische, kodierte Zeichenkette.
 */
export function prettyDirLabel(dir: Directory): string {
  if (dir.uri === defaultNotenDir().uri) return 'App-interner Speicher (Standard)';
  try {
    const decoded = decodeURIComponent(dir.uri);
    const match = decoded.match(/tree\/(?:primary:)?([^/]+(?:\/[^/]+)*?)(?:\/document\/.*)?$/);
    if (match?.[1]) return match[1].replace(/^primary:/, '');
  } catch {
    // Fallback unten: rohe URI anzeigen statt nichts
  }
  return dir.uri;
}

/** Öffnet den System-Ordnerauswahl-Dialog. `null`, wenn der Nutzer abgebrochen hat. */
export async function pickNotenDir(): Promise<Directory | null> {
  try {
    return await Directory.pickDirectoryAsync();
  } catch {
    return null;
  }
}

export async function setCustomNotenDir(dir: Directory): Promise<void> {
  await setNotenLocalDirUri(dir.uri);
}

export async function resetNotenDirToDefault(): Promise<void> {
  await setNotenLocalDirUri(null);
}

export async function getCachedUri(key: string): Promise<string | null> {
  const index = await readIndex();
  const uri = index[key];
  if (!uri) return null;
  return new File(uri).exists ? uri : null;
}

export async function downloadNote(key: string): Promise<string> {
  const dir = await getNotenDir();
  if (!dir.exists) dir.create({ intermediates: true });

  const token = await getToken();
  const destination = new File(dir, localFileNameForKey(key));

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
 * Funktioniert unabhängig vom aktuell konfigurierten Speicherort: jeder Eintrag trägt seine
 * eigene, zum Downloadzeitpunkt gespeicherte absolute URI, bleibt also auch nach einem
 * Ordnerwechsel an seinem bisherigen Ort nutzbar.
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

/**
 * Verschiebt die angegebenen, bereits heruntergeladenen Noten physisch in den aktuell
 * konfigurierten Ordner - z.B. nach einem Wechsel des Speicherorts in den Einstellungen.
 * Bereits fehlende Dateien werden übersprungen statt den ganzen Vorgang abzubrechen.
 */
export async function moveCachedNotesToCurrentDir(keys: string[]): Promise<number> {
  const dir = await getNotenDir();
  if (!dir.exists) dir.create({ intermediates: true });

  const index = await readIndex();
  let moved = 0;
  for (const key of keys) {
    const uri = index[key];
    if (!uri) continue;
    const file = new File(uri);
    if (!file.exists) continue;
    try {
      await file.move(dir);
      index[key] = file.uri;
      moved++;
    } catch {
      // einzelne fehlgeschlagene Verschiebung überspringen, Rest weiterlaufen lassen
    }
  }
  await writeIndex(index);
  return moved;
}
