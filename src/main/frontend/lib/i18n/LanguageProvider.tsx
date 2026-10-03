'use client'
import React, { createContext, useContext, useEffect, useState, useRef, forwardRef, createElement } from 'react'
import { useAuth } from '@/lib/auth'
import { getApiBase } from '@/lib/api'
import { Language, translate } from './translate'
const Context = createContext<{ language: Language; setLanguage: (value: Language) => void; content: Record<string, string> }>({ language: 'de', setLanguage: () => {}, content: {} })
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const [content, setContent] = useState<Record<string, string>>({})
  const [language, setLanguage] = useState<Language>('de')
  const [initialized, setInitialized] = useState(false)
  const [contentReady, setContentReady] = useState(false)
  useEffect(() => {
    try { if (localStorage.getItem('zupfer-language') === 'en') setLanguage('en') } catch {}
    setInitialized(true)
  }, [])
  useEffect(() => { document.documentElement.lang = language }, [language])
  useEffect(() => {
    let disposed = false
    const controller = new AbortController()
    setContent({})
    setContentReady(false)
    const timeout = window.setTimeout(() => controller.abort(), 10000)
    if (!loading) fetch(`${getApiBase()}/api/i18n`, { credentials: 'include', cache: 'no-store', signal: controller.signal })
      .then(response => response.ok ? response.json() : {})
      .then(data => { if (!controller.signal.aborted) setContent(data) })
      .catch(() => {})
      .finally(() => { window.clearTimeout(timeout); if (!disposed) setContentReady(true) })
    return () => { disposed = true; window.clearTimeout(timeout); controller.abort() }
  }, [user, loading])
  const change = (value: Language) => {
    setLanguage(value)
    try { localStorage.setItem('zupfer-language', value) } catch {}
  }
  if (!initialized || (language === 'en' && (loading || !contentReady))) {
    return <div role="status" aria-label="Loading" className="flex min-h-screen items-center justify-center"><span className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" /></div>
  }
  return <Context.Provider value={{ language, setLanguage: change, content }}>{children}</Context.Provider>
}
export function useLanguage() {
  const context = useContext(Context)
  return { ...context, t: (value: string) => translate(value, context.language, context.content) }
}
export function T({ value }: { value: React.ReactNode }) {
  const { t } = useLanguage()
  return <>{typeof value === 'string' ? t(value) : value}</>
}
// Translate only presentation attributes. Values, event handlers, names and URLs pass through unchanged.
type NativeTag = keyof React.JSX.IntrinsicElements
type NativeProps<K extends NativeTag> = { as: K } & React.JSX.IntrinsicElements[K]
const Native = forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & { as: NativeTag; alt?: string; placeholder?: string }>(function Native({ as, children, ...props }, ref) {
  const { t } = useLanguage()
  const translated: Record<string, unknown> = { ...props, ref }
  for (const key of ['placeholder', 'title', 'aria-label', 'alt']) {
    if (typeof translated[key] === 'string') {
      (translated as Record<string, unknown>)[key] = t(translated[key] as string)
    }
  }
  return createElement(as, translated, children)
})
export const L = Native as <K extends NativeTag>(props: NativeProps<K>) => React.ReactElement
export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { const close = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false) }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close) }, [])
  return <div ref={ref} className="relative shrink-0">
    <button type="button" aria-label={language === 'de' ? 'Sprache wählen' : 'Choose language'} title={language === 'de' ? 'Sprache wählen' : 'Choose language'} onClick={() => setOpen(value => !value)} className="rounded-lg border border-gray-200 bg-gray-100 p-1.5 text-gray-500 transition hover:border-green-500/50 hover:text-green-600 dark:border-white/10 dark:bg-slate-800 dark:text-gray-400 dark:hover:text-green-400">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M3 12h18M12 3c2.2 2.5 3.3 5.5 3.3 9S14.2 18.5 12 21c-2.2-2.5-3.3-5.5-3.3-9S9.8 5.5 12 3Z" /></svg>
    </button>
    {open && <div className="absolute right-0 top-full z-50 mt-2 w-36 rounded-xl border border-gray-200 bg-white p-1 shadow-2xl dark:border-white/10 dark:bg-slate-900">
      {(['de', 'en'] as const).map(value => <button key={value} type="button" onClick={() => { setLanguage(value); setOpen(false) }} className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-green-500/10 ${language === value ? 'font-semibold text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'}`}>{value === 'de' ? 'Deutsch' : 'English'}</button>)}
    </div>}
  </div>
}


const contentFields = new Set(['headline', 'subheadline', 'heading', 'description', 'role', 'roles', 'bio', 'markdown', 'caption', 'altText', 'location', 'note', 'details', 'cancellationNote', 'info', 'text', 'intro', 'targetGroup', 'content', 'question', 'answer', 'quote', 'label', 'ctaLabel', 'buttonLabel'])
export function useLocalizedContent() {
  const { language, content } = useContext(Context)
  return function localize<Value>(value: Value): Value {
    if (language === 'de') return value
    const overrides = (value as { _translations?: { en?: Record<string, string> } })?._translations?.en ?? {}
    const messages = { ...content, ...overrides }
    function visit(node: unknown, key = '', inVoices = false): unknown {
      if (typeof node === 'string') return contentFields.has(key) || (inVoices && key === 'name') ? (messages[node] ?? translate(node, language)) : node
      if (Array.isArray(node)) return node.map(item => visit(item, key, inVoices || key === 'voices'))
      if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).filter(([name]) => name !== '_translations').map(([name, item]) => [name, visit(item, name, inVoices)]))
      return node
    }
    return visit(value) as Value
  }
}

