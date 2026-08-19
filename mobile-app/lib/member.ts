import { apiFetch } from './api';

export async function updateMyProfile(patch: { vorname?: string; nachname?: string; username?: string }): Promise<void> {
  const res = await apiFetch('/api/member/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'Profil konnte nicht gespeichert werden');
  }
}

export async function changeMyPassword(aktuellesPasswort: string, neuesPasswort: string): Promise<void> {
  const res = await apiFetch('/api/member/me/password', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aktuellesPasswort, neuesPasswort }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'Passwort konnte nicht geändert werden');
  }
}

export interface Member {
  id: string;
  email: string;
  username: string;
  vorname: string;
  nachname: string;
  role: string;
  istAktiv: boolean;
  eintrittsdatum: string | null;
  gruppe: { wochentag: string; vonUhrzeit: string; bisUhrzeit: string; location?: { name?: string } } | null;
}

export async function searchMembers(search?: string): Promise<Member[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const res = await apiFetch(`/api/member${query}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'Mitglieder konnten nicht geladen werden');
  }
  return res.json();
}

export async function setMemberActive(id: string, active: boolean): Promise<void> {
  const endpoint = active ? 'reaktivieren' : 'deaktivieren';
  const res = await apiFetch(`/api/member/${id}/${endpoint}`, { method: 'PATCH' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'Aktion konnte nicht durchgeführt werden');
  }
}
