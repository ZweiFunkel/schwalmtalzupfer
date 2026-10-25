import { Platform } from 'react-native';
import { API_BASE } from './config';
import { readToken, writeToken, clearToken } from './tokenStore';

export const getToken = readToken;
const setToken = writeToken;
export const logout = clearToken;

export async function login(username: string, password: string): Promise<{ role: string }> {
  const res = await fetch(`${API_BASE}/api/auth/mobile/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, client: Platform.OS === 'web' ? 'web' : 'app' }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'Login fehlgeschlagen');
  }

  const data = await res.json();
  await setToken(data.token);
  return { role: data.role };
}

export interface MemberProfile {
  email: string;
  username: string;
  vorname: string;
  nachname: string;
  role: string;
  istAktiv: boolean;
  gruppe?: {
    wochentag?: string;
    vonUhrzeit?: string | null;
    bisUhrzeit?: string | null;
    location?: { name?: string; adresse?: string; parkplatzInfo?: string };
  };
  monatsbeitragCents?: number | null;
  individuellerPreis?: boolean;
  naechsteAenderung?: {
    gueltigAb: string;
    gruppeLabel: string;
    monatsbeitragCents: number | null;
  } | null;
}

export async function fetchMe(): Promise<MemberProfile | null> {
  const token = await getToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;

  const text = await res.text();
  const profile: MemberProfile | null = text ? JSON.parse(text) : null;
  // Die Web-App ist nur für Mitglieder, nicht für Gäste (serverseitig zusätzlich beim Login geprüft).
  if (Platform.OS === 'web' && profile?.role === 'ROLE_GUEST') {
    await logout();
    return null;
  }
  return profile;
}

// Rollen-Helper analog src/main/frontend/lib/auth.tsx - ersetzt die bisher pro Screen
// duplizierten inline-Checks (z.B. `profile?.role === 'ROLE_CHEF' || ...`).
export const isAdmin = (profile: MemberProfile | null) => profile?.role === 'ROLE_ADMIN';
export const isChef = (profile: MemberProfile | null) => ['ROLE_ADMIN', 'ROLE_CHEF'].includes(profile?.role ?? '');
export const isBoard = (profile: MemberProfile | null) => ['ROLE_ADMIN', 'ROLE_BOARD'].includes(profile?.role ?? '');
