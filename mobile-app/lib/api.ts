import { API_BASE } from './config';
import { getToken } from './auth';

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

export { API_BASE };
