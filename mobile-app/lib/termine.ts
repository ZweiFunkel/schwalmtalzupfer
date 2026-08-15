import { apiFetch } from './api';

export interface Termin {
  title: string;
  date: string;
  time?: string;
  location?: string;
  note?: string;
  details?: string;
  kategorie?: string;
  cancelled?: boolean;
  cancellationNote?: string;
}

interface PageSection {
  type: string;
  content: Record<string, unknown>;
}

interface PageResponse {
  sections: PageSection[];
}

export async function fetchTermine(): Promise<Termin[]> {
  const res = await apiFetch('/api/pages/termine');
  if (!res.ok) throw new Error('Termine konnten nicht geladen werden');
  const page: PageResponse = await res.json();

  const section = page.sections.find(s => s.type === 'TERMINE_LIST');
  const termine = section?.content?.termine;
  return Array.isArray(termine) ? (termine as Termin[]) : [];
}
