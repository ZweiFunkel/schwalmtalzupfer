import { apiFetch, API_BASE } from './api';

export type Kategorie = 'konzert' | 'jugend' | 'ausflug' | 'unterricht' | 'sonstige';

export interface KalenderTermin {
  id: string;
  titel: string;
  kategorie: Kategorie;
  startDatum: string; // ISO yyyy-MM-dd
  endDatum: string | null; // ISO yyyy-MM-dd
  uhrzeitVon: string | null; // HH:mm[:ss]
  uhrzeitBis: string | null; // HH:mm[:ss]
  ort: string | null;
  beschreibung: string | null;
  abgesagt: boolean;
  absageGrund: string | null;
  gitarrengruppeId: string | null;
  istUnterricht: boolean;
  generiert: boolean;
}

function buildQuery(von?: string, bis?: string): string {
  const params = new URLSearchParams();
  if (von) params.set('von', von);
  if (bis) params.set('bis', bis);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * Kombinierter Kalender (manuelle Termine + automatisch expandierte Unterrichtsstunden).
 * Öffentlich erreichbar, aber wie überall per apiFetch aufgerufen (JWT schadet nicht, falls vorhanden).
 * Ohne von/bis liefert das Backend selbst den Bereich [heute, heute+3 Monate].
 */
export async function fetchKalenderTermine(von?: string, bis?: string): Promise<KalenderTermin[]> {
  const res = await apiFetch(`/api/kalender/termine${buildQuery(von, bis)}`);
  if (!res.ok) throw new Error('Kalender konnte nicht geladen werden');
  return res.json();
}

/** URL zum ICS-Export für den angegebenen Zeitraum (zum Öffnen in der Kalender-App). */
export function kalenderIcsUrl(von?: string, bis?: string): string {
  return `${API_BASE}/api/kalender/ics${buildQuery(von, bis)}`;
}

export interface Benachrichtigungseinstellungen {
  konzerte: boolean;
  freizeiten: boolean;
  unterrichtErinnerung: boolean;
  pushToken: string | null;
}

export async function fetchBenachrichtigungen(): Promise<Benachrichtigungseinstellungen> {
  const res = await apiFetch('/api/kalender/benachrichtigungen');
  if (!res.ok) throw new Error('Benachrichtigungseinstellungen konnten nicht geladen werden');
  return res.json();
}

/** Nur die übergebenen Felder werden aktualisiert. `pushToken: ''` löscht den gespeicherten Token. */
export async function updateBenachrichtigungen(
  patch: Partial<Benachrichtigungseinstellungen>
): Promise<void> {
  const res = await apiFetch('/api/kalender/benachrichtigungen', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Benachrichtigungseinstellungen konnten nicht gespeichert werden');
}
