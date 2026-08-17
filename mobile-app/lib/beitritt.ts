import { API_BASE } from './config';
import { apiFetch } from './api';

export interface BeitrittRequest {
  antragstellerVorname: string;
  antragstellerNachname: string;
  email: string;
  telefon?: string;
  fuerKind: boolean;
  kindVorname?: string;
  kindNachname?: string;
  alterJahre?: number;
  gitarrenErfahrung?: string;
}

export async function submitBeitrittsantrag(payload: BeitrittRequest): Promise<void> {
  const res = await fetch(`${API_BASE}/api/beitritt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'Antrag konnte nicht gesendet werden');
  }
}

export interface MembershipApplication {
  id: string;
  antragstellerVorname: string;
  antragstellerNachname: string;
  email: string;
  telefon: string | null;
  fuerKind: boolean;
  kindVorname: string | null;
  kindNachname: string | null;
  alterJahre: number | null;
  gitarrenErfahrung: string | null;
  status: 'NEU' | 'IN_KONTAKT' | 'ANGENOMMEN' | 'ABGELEHNT';
  boardNotiz: string | null;
  createdAt: string;
  gitarrengruppe?: { id: string; wochentag: string; vonUhrzeit: string; bisUhrzeit: string };
}

export async function fetchAntraege(status?: MembershipApplication['status']): Promise<MembershipApplication[]> {
  const query = status ? `?status=${status}` : '';
  const res = await apiFetch(`/api/beitritt${query}`);
  if (!res.ok) throw new Error('Anträge konnten nicht geladen werden');
  return res.json();
}

export async function updateAntrag(
  id: string,
  patch: { gitarrengruppeId?: string; boardNotiz?: string; status?: 'IN_KONTAKT' | 'ABGELEHNT' }
): Promise<void> {
  const res = await apiFetch(`/api/beitritt/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'Aktualisierung fehlgeschlagen');
  }
}

export async function deleteAntrag(id: string): Promise<void> {
  const res = await apiFetch(`/api/beitritt/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Antrag konnte nicht gelöscht werden');
}
