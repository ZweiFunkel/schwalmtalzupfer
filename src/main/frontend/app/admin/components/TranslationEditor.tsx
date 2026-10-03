'use client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

const fields = new Set(['headline','subheadline','heading','title','description','role','roles','bio','markdown','caption','altText','location','note','details','cancellationNote','info','text','intro','targetGroup','content','question','answer','quote','label','ctaLabel','buttonLabel'])
export default function TranslationEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void }) {
  const { language, content: defaults } = useLanguage()
  const en = language === 'en'
  const originals = new Set<string>()
  function collect(value: unknown, key = '') {
    if (typeof value === 'string' && fields.has(key) && value.trim()) originals.add(value)
    else if (Array.isArray(value)) value.forEach(item => collect(item, key))
    else if (value && typeof value === 'object') Object.entries(value).forEach(([name,item]) => { if (name !== '_translations') collect(item, name) })
  }
  collect(content)
  const translations = content._translations as { en?: Record<string,string> } | undefined
  return <details className="mt-5 rounded-xl border border-white/10 p-4">
    <summary className="cursor-pointer font-semibold text-green-400">{en ? 'English content translations' : 'Englische Inhaltsübersetzungen'}</summary>
    <p className="my-3 text-sm text-gray-400">{en ? 'Translate the German content here. Changes are saved with this section. Names, links and dates stay unchanged.' : 'Übersetze hier die deutschen Inhalte. Änderungen werden zusammen mit dieser Sektion gespeichert. Namen, Links und Datumswerte bleiben unverändert.'}</p>
    <div className="space-y-4">{Array.from(originals).map((original,index) => <label key={original} className="block text-sm">
      <span className="mb-2 block whitespace-pre-wrap break-words text-gray-300" lang="de">{original}</span>
      <textarea lang="en" aria-label={`${en ? 'English translation' : 'Englische Übersetzung'} ${index+1}`} rows={original.length > 150 ? 5 : 2} value={translations?.en?.[original] ?? defaults[original] ?? ''} placeholder={en ? 'Enter English translation' : 'Englische Übersetzung eingeben'} onChange={event => onChange({ ...content, _translations: { ...translations, en: { ...translations?.en, [original]: event.target.value } } })} className="w-full rounded-lg border border-white/15 bg-slate-900 p-3 text-white" />
    </label>)}</div>
  </details>
}
