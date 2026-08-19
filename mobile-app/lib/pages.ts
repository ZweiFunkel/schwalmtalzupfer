import { apiFetch } from './api';

export interface PageMeta {
  id: string;
  slug: string;
  title: string;
  published: boolean;
}

interface NavConfig {
  dropdowns?: unknown[];
  hidden?: string[];
  fixedLinks?: unknown[];
}

export async function fetchPages(): Promise<PageMeta[]> {
  const res = await apiFetch('/api/pages');
  if (!res.ok) throw new Error('Seiten konnten nicht geladen werden');
  return res.json();
}

export async function fetchHiddenSlugs(): Promise<string[]> {
  try {
    const res = await apiFetch('/api/site/settings');
    if (!res.ok) return [];
    const data: Record<string, string> = await res.json();
    const navConfig: NavConfig = JSON.parse(data.nav_config ?? '{}');
    return navConfig.hidden ?? [];
  } catch {
    return [];
  }
}

export async function setMenuVisibility(slug: string, hidden: boolean): Promise<void> {
  const res = await apiFetch(`/api/pages/${slug}/menu-visibility`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hidden }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'Sichtbarkeit konnte nicht geändert werden');
  }
}
