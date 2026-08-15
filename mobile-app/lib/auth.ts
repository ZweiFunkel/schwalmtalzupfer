import * as SecureStore from 'expo-secure-store';
import { API_BASE } from './config';

const TOKEN_KEY = 'auth_token';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function login(username: string, password: string): Promise<{ role: string }> {
  const res = await fetch(`${API_BASE}/api/auth/mobile/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
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
    location?: { name?: string; adresse?: string };
  };
}

export async function fetchMe(): Promise<MemberProfile | null> {
  const token = await getToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
