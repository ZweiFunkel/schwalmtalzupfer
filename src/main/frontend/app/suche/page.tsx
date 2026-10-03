'use client'
import { useLanguage, T, L } from '@/lib/i18n/LanguageProvider'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { getApiBase } from '@/lib/api'

type Result = { title: string; excerpt: string; href: string; kind: string; englishTitle?: string; englishExcerpt?: string }
export default function SearchPage() {
  const { language } = useLanguage()
  const { user, loading } = useAuth()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [searched, setSearched] = useState(false)
  const request = useRef<AbortController | null>(null)
  const runSearch = async (term: string) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setBusy(true); setError(''); setWarning(''); setResults([]); setSearched(false)
    try {
      const response = await fetch(`${getApiBase()}/api/search?q=${encodeURIComponent(term)}`, { credentials: 'include', cache: 'no-store', signal: controller.signal })
      if (!response.ok) throw new Error('Die Suche ist gerade nicht verfügbar. Bitte versuche es erneut.')
      const unavailable = response.headers.get('X-Search-Unavailable')
      const data: Result[] = await response.json()
      if (!controller.signal.aborted) { setResults(data); setWarning(unavailable ? `Einige Bereiche sind gerade nicht erreichbar: ${unavailable}. Die übrigen Treffer werden angezeigt.` : ''); setSearched(true) }
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Die Suche ist fehlgeschlagen.')
    } finally { if (!controller.signal.aborted) setBusy(false) }
  }
  useEffect(() => {
    const initial = searchParams.get('q')?.trim() ?? ''
    if (initial.length >= 2) { setQuery(initial); void runSearch(initial) }
  }, [searchParams, user])
  useEffect(() => {
    request.current?.abort()
    setResults([]); setSearched(false); setBusy(false); setError('')
    return () => request.current?.abort()
  }, [user])
  async function search(e: React.FormEvent) {
    e.preventDefault()
    const term = query.trim()
    if (term.length >= 2) await runSearch(term)
  }
  return <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
    <h1 className="mb-3 text-3xl font-bold"><T value={"Website durchsuchen"} /></h1>
    <p className="mb-6 text-gray-600 dark:text-gray-400"><T value={"Seiten und Inhalte finden"} /><T value={user ? ' – einschließlich deiner zugänglichen Videos.' : '. Melde dich an, um auch interne Inhalte zu durchsuchen.'} /></p>
    <form onSubmit={search} role="search" className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="site-search" className="sr-only"><T value={"Suchbegriff"} /></label>
      <L as="input" id="site-search" value={query} onChange={e => setQuery(e.target.value)} required minLength={2} maxLength={150} type="search" placeholder="Zum Beispiel Gitarre oder Dä Stär" className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 dark:border-white/20 dark:bg-slate-900 dark:text-white" />
      <button disabled={busy || loading || query.trim().length < 2} className="rounded-xl bg-green-700 px-6 py-3 font-semibold text-white disabled:opacity-50"><T value={busy ? 'Suche läuft…' : 'Suchen'} /></button>
    </form>
    <div className="mt-6" aria-live="polite" aria-busy={busy}>
      {warning && <p role="status" className="mb-4 text-amber-700 dark:text-amber-300"><T value={warning} /></p>}
      {error && <p role="alert" className="text-red-600 dark:text-red-400"><T value={error} /></p>}
      {searched && <p className="mb-4 text-sm text-gray-500"><T value={results.length ? `${results.length} Treffer${results.length === 100 ? ' (maximal 100, bitte Suche eingrenzen)' : ''}` : 'Keine passenden Inhalte gefunden.'} /></p>}
      <ul className="space-y-3">{results.map(r => <li key={`${r.href}-${r.title}`} className="rounded-xl border border-gray-200 p-5 dark:border-white/10">
        <span className="text-xs text-gray-500"><T value={r.kind} /></span>
        <Link href={r.href} className="mt-1 block break-words text-lg font-semibold text-green-700 hover:underline dark:text-green-400">{language === 'en' ? r.englishTitle ?? r.title : r.title}</Link>
        <p className="mt-2 break-words text-sm text-gray-600 dark:text-gray-300">{language === 'en' ? r.englishExcerpt ?? r.excerpt : r.excerpt}</p>
      </li>)}</ul>
    </div>
  </div>
}


