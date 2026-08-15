import { apiFetch } from './api';

export interface Gruppe {
  id: string;
  wochentag: string;
  vonUhrzeit: string;
  bisUhrzeit: string;
  location?: { id: string; name: string; adresse: string };
}

export async function fetchGruppen(): Promise<Gruppe[]> {
  const res = await apiFetch('/api/gruppen');
  if (!res.ok) throw new Error('Gruppen konnten nicht geladen werden');
  return res.json();
}
