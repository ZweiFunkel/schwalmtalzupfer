import { apiFetch } from './api';

export async function updateMyProfile(patch: { vorname?: string; nachname?: string }): Promise<void> {
  const res = await apiFetch('/api/member/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Profil konnte nicht gespeichert werden');
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
