/**
 * Gibt die API-Basis-URL zurück.
 *
 * - Client-seitig (Browser): immer '' (relative URL, same-origin)
 *   → kein CORS, funktioniert mit jeder Domain/IP.
 *
 * - Server-seitig (generateStaticParams, SSR):
 *   BACKEND_URL env-var (z.B. http://localhost:8081) oder dev-Fallback.
 *   BACKEND_URL wird nie in den Client-Bundle eingebettet.
 *
 * HINWEIS: NEXT_PUBLIC_API_URL wird absichtlich NICHT mehr verwendet –
 * es würde eine absolute URL in den Bundle einbaken und bei CORS-Szenarien
 * (z.B. Zugriff über IP statt Domain) zu Fehlern führen.
 */
export function getApiBase(): string {
  // Serverseitig (Server Components / generateStaticParams):
  // Node.js braucht absolute URL – BACKEND_URL landet NIE im Client-Bundle.
  if (typeof window === 'undefined') {
    const serverUrl = process.env['BACKEND_URL']
    if (serverUrl && serverUrl.trim() !== '') return serverUrl.trim()
    return 'http://localhost:8081'
  }

  // Client-seitig: leerer String = relative URL = same-origin, kein CORS.
  return ''
}

