/**
 * Gibt die API-Basis-URL zurück.
 * Leerer String in NEXT_PUBLIC_API_URL → Fallback auf localhost:8080 (Dev-Modus).
 * Im Browser-Kontext (Client Components) wird ein leerer String als relative URL durchgereicht,
 * da dort der Next.js-Proxy greift.
 */
export function getApiBase(): string {
  const env = process.env['NEXT_PUBLIC_API_URL']
  if (env && env.trim() !== '') return env.trim()
  // Server-Side: immer absolute URL benötigt
  if (typeof window === 'undefined') return 'https://localhost:8080'
  // Client-Side: leer = relativer Pfad, Next.js-Proxy leitet weiter
  return ''
}

