// Farbtokens 1:1 aus dem Web-Frontend (tailwind.config.js -> theme.extend.colors.primary)
export const colors = {
  primary50: '#f0fdf4',
  primary500: '#22c55e',
  primary600: '#16a34a',
  primary700: '#15803d',

  background: '#ffffff',
  surface: '#ffffff',
  surfaceMuted: '#f7f8f7',
  border: '#e5e7eb',

  text: '#111827',
  textMuted: '#6b7280',
  textFaint: '#9ca3af',

  danger: '#dc2626',
  dangerMuted: '#fef2f2',
};

export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
};

// Ab dieser Breite gilt das Gerät als Tablet (iPad mini portrait = 744, iPad portrait = 768).
export const TABLET_BREAKPOINT = 700;

export function columnsForWidth(width: number): number {
  if (width >= 1100) return 3;
  if (width >= TABLET_BREAKPOINT) return 2;
  return 1;
}
