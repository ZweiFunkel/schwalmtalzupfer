import type { Ionicons } from '@expo/vector-icons';
import type { Kategorie } from './kalender';

export interface KategorieMeta {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

// Konsistent mit dem Web-Kalender (/intern/kalender) und dem Admin-Kalender-Tab.
export const KATEGORIE_META: Record<Kategorie, KategorieMeta> = {
  konzert: { label: 'Konzert', icon: 'musical-notes', color: '#16a34a' },
  jugend: { label: 'Jugendgruppe', icon: 'people', color: '#0284c7' },
  ausflug: { label: 'Ausflug', icon: 'bus', color: '#d97706' },
  unterricht: { label: 'Unterricht', icon: 'school', color: '#7c3aed' },
  sonstige: { label: 'Termin', icon: 'calendar', color: '#6b7280' },
};

export function kategorieMeta(kategorie: Kategorie): KategorieMeta {
  return KATEGORIE_META[kategorie] ?? KATEGORIE_META.sonstige;
}
