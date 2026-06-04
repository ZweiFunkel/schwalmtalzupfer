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
  // Kein localhost-Fallback! Leerer String = relative URL (im Dev durch Proxy abgefangen).
  // Im Prod-Build MUSS NEXT_PUBLIC_API_URL gesetzt sein, sonst schlägt die API fehl.
  return ''
}

