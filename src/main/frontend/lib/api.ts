/**
 * Gibt die API-Basis-URL zurück.
 *
 * - Dev-Modus:   NEXT_PUBLIC_API_URL leer lassen → leerer String = relative URL,
 *                Next.js-Proxy leitet /api/* und /r2/* an localhost:8080 weiter (next.config.mjs).
 * - Production:  NEXT_PUBLIC_API_URL=https://www.schwalmtalzupfer.de setzen (Build-Zeit-Variable!),
 *                da der Static Export keine relativen URLs kennt.
 *
 * KEIN Fallback auf localhost:8080 – das würde im Production-Build eingebettet
 * und dann vom Browser des Besuchers versucht werden (= defekt).
 */
export function getApiBase(): string {
  const env = process.env['NEXT_PUBLIC_API_URL']
  if (env && env.trim() !== '') return env.trim()

  // Serverseitig (Server Components / generateStaticParams) benötigen wir eine absolute URL,
  // da Node.js keine relativen URLs auflösen kann.
  // BACKEND_URL wird nur serverseitig gelesen und landet nie im Client-Bundle.
  if (typeof window === 'undefined') {
    const serverUrl = process.env['BACKEND_URL']
    if (serverUrl && serverUrl.trim() !== '') return serverUrl.trim()
    // Dev-Fallback: Backend läuft auf Port 8081
    return 'http://localhost:8081'
  }

  // Clientseitig: leerer String = relative URL → wird durch Next.js-Proxy weitergeleitet.
  // Im Prod-Build MUSS NEXT_PUBLIC_API_URL gesetzt sein, sonst schlägt die API fehl.
  return ''
}

