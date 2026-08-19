'use client'
import { getApiBase } from '@/lib/api'
import { useEffect, useState } from 'react'
import { ImageField } from './ImageField'

const API_BASE = getApiBase()

interface MeldungItem { id: string; title: string; text: string; body: string; imageUrl?: string; style: 'info' | 'warning' | 'success'; activeForBanner: boolean; validFrom?: string; validUntil?: string }

function parseDMY(s: string): Date { const p = s.split('.'); return new Date(+p[2], +p[1] - 1, +p[0]) }
function meldungScheduleStatus(m: MeldungItem): 'scheduled-active' | 'scheduled-future' | 'scheduled-expired' | 'manual-active' | 'inactive' {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (m.validFrom || m.validUntil) {
    const from  = m.validFrom  ? parseDMY(m.validFrom)  : null
    const until = m.validUntil ? parseDMY(m.validUntil) : null
    if (from && from > today) return 'scheduled-future'
    if (until && until < today) return 'scheduled-expired'
    return 'scheduled-active'
  }
  return m.activeForBanner ? 'manual-active' : 'inactive'
}

const MELDUNG_STYLE_COLORS: Record<string, { label: string; dot: string }> = {
  info:    { label: 'Blau (Info)',   dot: 'bg-blue-500' },
  warning: { label: 'Amber (Warnung)', dot: 'bg-amber-500' },
  success: { label: 'Grün (Erfolg)', dot: 'bg-green-500' },
}

export default function MeldungenTab() {
  const [meldungen, setMeldungen] = useState<MeldungItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/site/settings`)
      .then(r => r.json())
      .then((data: Record<string, string>) => {
        if (data.meldungen) {
          try { setMeldungen(JSON.parse(data.meldungen)) } catch { /* ignore */ }
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async (list: MeldungItem[]) => {
    setSaving(true)
    await fetch(`${API_BASE}/api/site/meldungen`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: JSON.stringify(list) }),
    })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const update = (id: string, patch: Partial<MeldungItem>) => {
    setMeldungen(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))
  }

  const addNew = () => {
    const newM: MeldungItem = { id: crypto.randomUUID(), title: 'Neue Meldung', text: '', body: '', imageUrl: '', style: 'warning', activeForBanner: false, validFrom: undefined, validUntil: undefined }
    setMeldungen(prev => [newM, ...prev])
    setExpanded(newM.id)
  }

  const remove = (id: string) => {
    if (!confirm('Meldung wirklich löschen?')) return
    setMeldungen(prev => prev.filter(m => m.id !== id))
  }

  const toggleBanner = (id: string) => {
    setMeldungen(prev => prev.map(m => ({ ...m, activeForBanner: m.id === id ? !m.activeForBanner : false })))
  }

  if (loading) return <p className="text-gray-400 text-sm py-4">Lade Meldungen…</p>

  return (
    <div className="space-y-4">
      {/* Header + Add */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">
            Erstelle Info-Meldungen. Eine kann als Banner oben aktiviert werden – andere lassen sich mit abgesagten Terminen verknüpfen.
          </p>
        </div>
        <button onClick={addNew}
          className="shrink-0 rounded-lg border border-dashed border-green-500/40 bg-green-900/10 px-3 py-1.5 text-xs text-green-400 hover:bg-green-900/20 transition">
          + Neue Meldung
        </button>
      </div>

      {meldungen.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 py-10 text-center">
          <p className="text-sm text-gray-500">Noch keine Meldungen.</p>
          <button onClick={addNew} className="mt-3 text-sm text-green-400 hover:text-green-300 transition">
            + Erste Meldung erstellen
          </button>
        </div>
      )}

      {meldungen.map(m => {
        const isOpen = expanded === m.id
        const colorDot = MELDUNG_STYLE_COLORS[m.style]?.dot ?? 'bg-gray-500'
        const status = meldungScheduleStatus(m)
        const STATUS_CFG = {
          'scheduled-active':  { label: '🟢 Aktiv (Zeitplan)',   cls: 'bg-green-500/15 border-green-500/30 text-green-400',  cardCls: 'border-green-500/30 bg-green-900/5' },
          'scheduled-future':  { label: `🔵 Geplant ab ${m.validFrom}`, cls: 'bg-blue-500/15 border-blue-500/30 text-blue-400',  cardCls: 'border-blue-500/20 bg-blue-900/5' },
          'scheduled-expired': { label: '⚪ Abgelaufen',          cls: 'bg-white/5 border-white/10 text-gray-600',             cardCls: 'border-white/8 bg-slate-900 opacity-60' },
          'manual-active':     { label: '✋ Manuell aktiv',       cls: 'bg-amber-500/15 border-amber-500/30 text-amber-400',   cardCls: 'border-amber-500/30 bg-amber-900/10' },
          'inactive':          { label: '',                        cls: '',                                                      cardCls: 'border-white/10 bg-slate-900' },
        } as const
        const sCfg = STATUS_CFG[status]
        return (
          <div key={m.id} className={`rounded-xl border overflow-hidden transition ${sCfg.cardCls}`}>
            {/* Row header */}
            <div className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => toggleBanner(m.id)} title="Manuell als Banner aktivieren"
                className={`shrink-0 flex h-5 w-9 rounded-full transition ${status === 'manual-active' ? 'bg-amber-500' : 'bg-slate-700'}`}>
                <div className={`m-0.5 h-4 w-4 rounded-full bg-white transition-transform ${status === 'manual-active' ? 'translate-x-4' : ''}`} />
              </button>
              <span className={`h-2 w-2 rounded-full shrink-0 ${colorDot}`} />
              <span className="flex-1 truncate text-sm font-medium text-white">
                {m.title || <span className="text-gray-500 italic">Ohne Titel</span>}
              </span>
              {sCfg.label && (
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold shrink-0 ${sCfg.cls}`}>
                  {sCfg.label}
                </span>
              )}
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => setExpanded(isOpen ? null : m.id)}
                  className="rounded px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-white transition">
                  {isOpen ? '▲ Einklappen' : '▼ Bearbeiten'}
                </button>
                <button onClick={() => remove(m.id)}
                  className="rounded px-2 py-1 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 transition">✕</button>
              </div>
            </div>

            {/* Edit form */}
            {isOpen && (
              <div className="border-t border-white/10 p-4 flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">Titel <span className="text-gray-600">(nur intern – zur Unterscheidung)</span></label>
                    <input value={m.title} onChange={e => update(m.id, { title: e.target.value })}
                      placeholder="z.B. Sommerkonzert 2026 abgesagt"
                      className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-green-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">Farbe</label>
                    <div className="flex gap-2 pt-0.5">
                      {(Object.entries(MELDUNG_STYLE_COLORS) as [string, { label: string; dot: string }][]).map(([v, c]) => (
                        <button key={v} onClick={() => update(m.id, { style: v as MeldungItem['style'] })}
                          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                            m.style === v ? 'border-green-500/40 bg-green-900/30 text-green-400' : 'border-white/10 bg-slate-800 text-gray-400 hover:text-white'
                          }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">Kurztext <span className="text-gray-600">(im Banner + Popup-Header)</span></label>
                  <input value={m.text} onChange={e => update(m.id, { text: e.target.value })}
                    placeholder="z.B. Das Sommerkonzert 2026 fällt leider aus."
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-green-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">Beitragstext <span className="text-gray-600">(optional – erscheint im Popup)</span></label>
                  <textarea value={m.body} onChange={e => update(m.id, { body: e.target.value })}
                    rows={4} placeholder="Ausführliche Infos, Hintergründe, Alternativen..."
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white resize-y focus:border-green-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">Bild im Popup <span className="text-gray-600">(optional – erscheint über dem Text)</span></label>
                  <ImageField label="" value={m.imageUrl ?? ''} onChange={v => update(m.id, { imageUrl: v })} />
                </div>
                {/* Zeitplan */}
                <div className="rounded-lg border border-white/8 bg-slate-800/50 p-3 flex flex-col gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    🗓 Zeitplan <span className="normal-case font-normal text-gray-600">(optional – Banner erscheint automatisch im angegebenen Zeitraum)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">Von</label>
                      <input type="text" value={m.validFrom ?? ''} onChange={e => update(m.id, { validFrom: e.target.value || undefined })}
                        placeholder="dd.MM.yyyy"
                        className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:border-green-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">Bis (inkl.)</label>
                      <input type="text" value={m.validUntil ?? ''} onChange={e => update(m.id, { validUntil: e.target.value || undefined })}
                        placeholder="dd.MM.yyyy"
                        className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:border-green-500 focus:outline-none" />
                    </div>
                  </div>
                  {(m.validFrom || m.validUntil) && (
                    <button onClick={() => update(m.id, { validFrom: undefined, validUntil: undefined, activeForBanner: false })}
                      className="self-start text-[11px] text-red-400/70 hover:text-red-400 transition">
                      ✕ Zeitplan entfernen
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                  <label className={`flex items-center gap-2 cursor-pointer ${m.validFrom || m.validUntil ? 'opacity-40 pointer-events-none' : ''}`}>
                    <div onClick={() => toggleBanner(m.id)}
                      className={`relative h-5 w-9 rounded-full transition ${m.activeForBanner && !m.validFrom && !m.validUntil ? 'bg-amber-500' : 'bg-slate-700'}`}>
                      <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${m.activeForBanner && !m.validFrom && !m.validUntil ? 'translate-x-4' : ''}`} />
                    </div>
                    <span className="text-xs text-gray-400">Manuell als Banner aktivieren <span className="text-gray-600">(deaktiviert andere; wird durch Zeitplan überschrieben)</span></span>
                  </label>
                  <p className="ml-auto text-[10px] text-gray-600 font-mono truncate">ID: {m.id.slice(0, 8)}…</p>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {meldungen.length > 0 && (
        <button onClick={() => save(meldungen)} disabled={saving}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">
          {saving ? 'Speichert…' : saved ? '✓ Gespeichert!' : '✓ Alle Meldungen speichern'}
        </button>
      )}
    </div>
  )
}
