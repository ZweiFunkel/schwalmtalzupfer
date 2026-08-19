import { API_BASE } from './config';
import { getToken } from './auth';

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

export { API_BASE };

/** Backend liefert für R2-Assets teils absolute URLs (falls app.r2.public-url konfiguriert
 *  ist), teils nur einen relativen Fallback-Pfad wie "/r2/...". Ein relativer Pfad lässt sich
 *  im Web-Frontend anstandslos gegen die aktuelle Seite auflösen, in der App gibt es dafür aber
 *  keinen impliziten Ursprung - RN Image lädt so etwas kommentarlos gar nicht. Deshalb hier
 *  immer explizit gegen API_BASE auflösen. */
export function absoluteApiUrl(path: string): string {
  return path.startsWith('http') ? path : `${API_BASE}${path}`;
}
