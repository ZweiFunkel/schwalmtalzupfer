/**
 * Prüft Links aus Admin-Feldern (Karten-, Ticket-, Button-Links) bevor sie in ein href gelangen.
 * Erlaubt sind http(s), mailto, tel und relative Pfade/Anker; alles andere (z. B. javascript:, data:)
 * liefert undefined, der Link wird dann nicht ausgegeben bzw. ist nicht klickbar.
 */
export function safeUrl(value?: string | null): string | undefined {
  const raw = (value ?? '').trim()
  if (!raw) return undefined
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw
  if (raw.startsWith('#')) return raw
  try {
    const url = new URL(raw)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? raw : undefined
  } catch {
    return undefined
  }
}

/** Wie safeUrl, ergänzt aber https:// bei Angaben wie "example.de" (Webseiten-Felder). */
export function safeWebsiteUrl(value?: string | null): string | undefined {
  const raw = (value ?? '').trim()
  if (!raw) return undefined
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return safeUrl(raw)
  return safeUrl(`https://${raw}`)
}
