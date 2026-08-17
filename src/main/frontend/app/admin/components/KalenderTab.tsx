'use client'
import { getApiBase } from '@/lib/api'
import React, { useCallback, useEffect, useState } from 'react'

const API_BASE = getApiBase()

// ─── Typen ──────────────────────────────────────────────────────────────────
export type KalenderKategorie = 'konzert' | 'jugend' | 'ausflug' | 'unterricht' | 'sonstige'

export interface KalenderTermin {
  id: string
  titel: string
  kategorie: KalenderKategorie
  startDatum: string          // YYYY-MM-DD
  endDatum?: string | null
  uhrzeitVon?: string | null  // HH:mm(:ss)
  uhrzeitBis?: string | null
  ort?: string | null
  beschreibung?: string | null
  abgesagt?: boolean
  absageGrund?: string | null
  gitarrengruppeId?: string | null
  istUnterricht?: boolean
  generiert?: boolean         // true = automatisch expandierter Unterrichtstermin, nicht editierbar
}

interface KalenderAusnahme {
  id: string
  datum: string
  grund: string
  gitarrengruppeId?: string | null
}

interface Gruppe {
  id: string
  wochentag: string
  vonUhrzeit: string
  bisUhrzeit: string
  location?: { id: string; name: string }
}

const KAT_INFO: Record<KalenderKategorie, { label: string; icon: string }> = {
  konzert:    { label: 'Konzert',    icon: '🎸' },
  jugend:     { label: 'Jugend',     icon: '🏕️' },
  ausflug:    { label: 'Ausflug',    icon: '🚌' },
  unterricht: { label: 'Unterricht', icon: '🎓' },
  sonstige:   { label: 'Sonstiges',  icon: '📅' },
}
const KATEGORIEN: KalenderKategorie[] = ['konzert', 'jugend', 'ausflug', 'unterricht', 'sonstige']
const katInfo = (k: string) => KAT_INFO[k as KalenderKategorie] ?? KAT_INFO.sonstige

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

function isoToDe(iso?: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}.${m}.${y}`
}
function todayIso(): string { return new Date().toISOString().slice(0, 10) }
function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
function hhmm(t?: string | null): string { return t ? t.slice(0, 5) : '' }

const emptyDraft = (): Partial<KalenderTermin> => ({
  titel: '', kategorie: 'sonstige', startDatum: todayIso(), endDatum: '',
  uhrzeitVon: '', uhrzeitBis: '', ort: '', beschreibung: '', abgesagt: false,
  absageGrund: '', gitarrengruppeId: '', istUnterricht: false,
})

// ─── Kleine gemeinsame Form-Bausteine (eigenständig, da diese Datei separat
//     von admin/page.tsx importiert wird) ───────────────────────────────────
function LabeledInput({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:border-green-500 focus:outline-none" />
    </div>
  )
}

function KategorieChips({ value, onChange }: { value: KalenderKategorie; onChange: (k: KalenderKategorie) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">Kategorie</label>
      <div className="flex gap-2 flex-wrap">
        {KATEGORIEN.map(k => (
          <button key={k} type="button" onClick={() => onChange(k)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              value === k ? 'bg-green-900/40 border-green-500/40 text-green-400' : 'bg-slate-800 border-white/10 text-gray-400 hover:text-white'
            }`}>
            {KAT_INFO[k].icon} {KAT_INFO[k].label}
          </button>
        ))}
      </div>
    </div>
  )
}

function GruppeSelect({ value, onChange, gruppen }: { value: string; onChange: (v: string) => void; gruppen: Gruppe[] }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">
        Gitarrengruppe <span className="text-gray-600">(optional, für Unterrichtstermine)</span>
      </label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-green-500 focus:outline-none">
        <option value="">– keine Gruppe –</option>
        {gruppen.map(g => (
          <option key={g.id} value={g.id}>
            {g.wochentag} {g.vonUhrzeit}–{g.bisUhrzeit}{g.location ? ` (${g.location.name})` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

// ─── Kalender-Tab ───────────────────────────────────────────────────────────
export default function KalenderTab() {
  const [von, setVon] = useState(todayIso())
  const [bis, setBis] = useState(addDaysIso(todayIso(), 90))
  const [termine, setTermine] = useState<KalenderTermin[]>([])
  const [loadingTermine, setLoadingTermine] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<KalenderKategorie | 'alle'>('alle')

  const [gruppen, setGruppen] = useState<Gruppe[]>([])

  const [ausnahmen, setAusnahmen] = useState<KalenderAusnahme[]>([])
  const [newAusnahme, setNewAusnahme] = useState({ datum: '', grund: '', gitarrengruppeId: '' })
  const [ausnahmeMsg, setAusnahmeMsg] = useState('')

  const [expanded, setExpanded] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Partial<KalenderTermin>>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [newDraft, setNewDraft] = useState<Partial<KalenderTermin>>(emptyDraft())

  const [ausfallExpanded, setAusfallExpanded] = useState<string | null>(null)
  const [ausfallGrund, setAusfallGrund] = useState('Kein Unterricht')

  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [syncing, setSyncing] = useState(false)

  const loadTermine = useCallback(async () => {
    setLoadingTermine(true); setLoadError('')
    try {
      const res = await fetch(`${API_BASE}/api/kalender/termine?von=${von}&bis=${bis}`, { credentials: 'include' })
      if (res.ok) setTermine(await res.json())
      else setLoadError(`Laden fehlgeschlagen (${res.status})`)
    } catch {
      setLoadError('Laden fehlgeschlagen – bitte Verbindung prüfen.')
    } finally {
      setLoadingTermine(false)
    }
  }, [von, bis])

  const loadAusnahmen = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/kalender/ausnahmen`, { credentials: 'include' })
    if (res.ok) setAusnahmen(await res.json())
  }, [])

  const loadGruppen = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/gruppen`, { credentials: 'include' })
    if (res.ok) setGruppen(await res.json())
  }, [])

  useEffect(() => { loadTermine() }, [loadTermine])
  useEffect(() => { loadAusnahmen(); loadGruppen() }, [loadAusnahmen, loadGruppen])

  const gruppeLabel = (id?: string | null): string | null => {
    if (!id) return null
    const g = gruppen.find(g => g.id === id)
    if (!g) return null
    return `${g.wochentag} ${g.vonUhrzeit}–${g.bisUhrzeit}${g.location ? ` (${g.location.name})` : ''}`
  }

  const toBody = (d: Partial<KalenderTermin>) => ({
    titel: d.titel?.trim() ?? '',
    kategorie: d.kategorie ?? 'sonstige',
    startDatum: d.startDatum,
    endDatum: d.endDatum || null,
    uhrzeitVon: d.uhrzeitVon || null,
    uhrzeitBis: d.uhrzeitBis || null,
    ort: d.ort || null,
    beschreibung: d.beschreibung || null,
    abgesagt: d.abgesagt ?? false,
    absageGrund: d.absageGrund || null,
    gitarrengruppeId: d.gitarrengruppeId || null,
    istUnterricht: d.istUnterricht ?? false,
  })

  const startEdit = (t: KalenderTermin) => {
    setDrafts(d => ({ ...d, [t.id]: { ...t } }))
    setExpanded(e => (e === t.id ? null : t.id))
  }
  const updateDraft = (id: string, patch: Partial<KalenderTermin>) =>
    setDrafts(d => ({ ...d, [id]: { ...d[id], ...patch } }))

  const saveEdit = async (id: string) => {
    const draft = drafts[id]
    if (!draft) return
    if (!draft.titel?.trim() || !draft.startDatum) { alert('Titel und Start-Datum sind Pflichtfelder.'); return }
    setSaving(id)
    try {
      const res = await fetch(`${API_BASE}/api/kalender/termine/${id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toBody(draft)),
      })
      if (res.ok) { setExpanded(null); loadTermine() }
      else { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Speichern fehlgeschlagen.') }
    } finally { setSaving(null) }
  }

  const deleteTermin = async (id: string) => {
    if (!confirm('Termin wirklich löschen?')) return
    const res = await fetch(`${API_BASE}/api/kalender/termine/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) { setExpanded(null); loadTermine() }
    else alert('Löschen fehlgeschlagen.')
  }

  const createTermin = async () => {
    if (!newDraft.titel?.trim() || !newDraft.startDatum) { alert('Titel und Start-Datum sind Pflichtfelder.'); return }
    setSaving('__new__')
    try {
      const res = await fetch(`${API_BASE}/api/kalender/termine`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toBody(newDraft)),
      })
      if (res.ok) { setCreating(false); setNewDraft(emptyDraft()); loadTermine() }
      else { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Anlegen fehlgeschlagen.') }
    } finally { setSaving(null) }
  }

  const confirmAusfall = async (t: KalenderTermin) => {
    const res = await fetch(`${API_BASE}/api/kalender/ausnahmen`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datum: t.startDatum, grund: ausfallGrund.trim() || 'Kein Unterricht', gitarrengruppeId: t.gitarrengruppeId ?? null }),
    })
    if (res.ok) { setAusfallExpanded(null); setAusfallGrund('Kein Unterricht'); loadAusnahmen(); loadTermine() }
    else alert('Ausnahme konnte nicht angelegt werden.')
  }

  const addAusnahme = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAusnahme.datum || !newAusnahme.grund.trim()) return
    const res = await fetch(`${API_BASE}/api/kalender/ausnahmen`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datum: newAusnahme.datum, grund: newAusnahme.grund.trim(), gitarrengruppeId: newAusnahme.gitarrengruppeId || null }),
    })
    if (res.ok) { setNewAusnahme({ datum: '', grund: '', gitarrengruppeId: '' }); loadAusnahmen(); loadTermine() }
    else { setAusnahmeMsg('Anlegen fehlgeschlagen.'); setTimeout(() => setAusnahmeMsg(''), 3000) }
  }

  const deleteAusnahme = async (id: string) => {
    if (!confirm('Ausnahme wirklich löschen?')) return
    const res = await fetch(`${API_BASE}/api/kalender/ausnahmen/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) { loadAusnahmen(); loadTermine() }
  }

  const syncFerien = async () => {
    setSyncing(true); setSyncMsg(null)
    try {
      const res = await fetch(`${API_BASE}/api/kalender/ferien/sync`, { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) setSyncMsg({ ok: true, text: `✓ ${data.anzahl} Ferientermin(e) synchronisiert.` })
      else setSyncMsg({ ok: false, text: data.error ?? 'Synchronisierung fehlgeschlagen.' })
    } catch {
      setSyncMsg({ ok: false, text: 'Synchronisierung fehlgeschlagen – bitte Verbindung prüfen.' })
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(null), 6000)
    }
  }

  // ── Gruppierung nach Monat für die Agenda-Ansicht ─────────────────────────
  const filtered = termine
    .filter(t => filter === 'alle' || t.kategorie === filter)
    .slice()
    .sort((a, b) => {
      const d = a.startDatum.localeCompare(b.startDatum)
      if (d !== 0) return d
      return (a.uhrzeitVon ?? '').localeCompare(b.uhrzeitVon ?? '')
    })

  const groups: { key: string; label: string; items: KalenderTermin[] }[] = []
  for (const t of filtered) {
    const [y, m] = t.startDatum.split('-')
    const key = `${y}-${m}`
    let g = groups.find(g => g.key === key)
    if (!g) { g = { key, label: `${MONTH_NAMES[parseInt(m, 10) - 1] ?? m} ${y}`, items: [] }; groups.push(g) }
    g.items.push(t)
  }

  const renderTermin = (t: KalenderTermin) => {
    const isGenerated = !!t.generiert
    const isEditing = expanded === t.id
    const isAusfallOpen = ausfallExpanded === t.id
    const draft = drafts[t.id] ?? t
    const info = katInfo(t.kategorie)
    const dateLabel = t.endDatum && t.endDatum !== t.startDatum
      ? `${isoToDe(t.startDatum)} – ${isoToDe(t.endDatum)}`
      : isoToDe(t.startDatum)
    const timeLabel = t.uhrzeitVon
      ? (t.uhrzeitBis ? `${hhmm(t.uhrzeitVon)} – ${hhmm(t.uhrzeitBis)}` : hhmm(t.uhrzeitVon))
      : ''
    const isOpen = isGenerated ? isAusfallOpen : isEditing

    return (
      <div key={t.id} className={`rounded-xl border overflow-hidden transition ${
        t.abgesagt ? 'border-red-500/30 bg-red-900/10' : isGenerated ? 'border-white/8 bg-slate-900/40' : 'border-white/10 bg-slate-900'
      }`}>
        <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none"
          onClick={() => isGenerated ? setAusfallExpanded(v => v === t.id ? null : t.id) : startEdit(t)}>
          <span className="text-base shrink-0">{info.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{t.titel}</p>
            <p className="text-[11px] text-gray-500 font-mono mt-0.5">
              {dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}{t.ort ? ` · ${t.ort}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isGenerated && (
              <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-gray-400 font-semibold uppercase" title="Automatisch aus der Gitarrengruppe erzeugt">
                🔒 Automatisch
              </span>
            )}
            {t.abgesagt && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-400 font-bold uppercase">Abgesagt</span>}
            <span className="text-gray-600 text-xs">{isOpen ? '▲' : '▼'}</span>
          </div>
        </div>

        {isGenerated && isAusfallOpen && (
          <div className="border-t border-white/8 p-3 flex flex-col gap-2 bg-slate-950/40">
            <p className="text-xs text-gray-400">
              Dieser Unterrichtstermin wird automatisch aus der Gitarrengruppe erzeugt und kann nicht direkt bearbeitet oder
              gelöscht werden. Um ihn am <strong className="text-white">{isoToDe(t.startDatum)}</strong> ausfallen zu lassen,
              wird eine Ausnahme für diesen Tag angelegt.
            </p>
            <LabeledInput label="Grund" value={ausfallGrund} onChange={setAusfallGrund} placeholder="z.B. Ferien, Feiertag, Krankheit" />
            <div className="flex gap-2">
              <button onClick={() => confirmAusfall(t)}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 transition">
                🚫 Unterricht ausfallen lassen
              </button>
              <button onClick={() => setAusfallExpanded(null)}
                className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-slate-600 transition">
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {!isGenerated && isEditing && (
          <div className="border-t border-white/8 p-3 flex flex-col gap-3">
            <LabeledInput label="Titel" value={draft.titel ?? ''} onChange={v => updateDraft(t.id, { titel: v })} />
            <KategorieChips value={(draft.kategorie as KalenderKategorie) ?? 'sonstige'} onChange={k => updateDraft(t.id, { kategorie: k })} />

            <div className="rounded-lg border border-white/8 bg-slate-800/50 p-3 flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">📅 Datum</p>
              <div className="grid grid-cols-2 gap-2">
                <LabeledInput type="date" label="Start" value={draft.startDatum ?? ''} onChange={v => updateDraft(t.id, { startDatum: v })} />
                <LabeledInput type="date" label="Ende (optional)" value={draft.endDatum ?? ''} onChange={v => updateDraft(t.id, { endDatum: v })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <LabeledInput type="time" label="Uhrzeit von" value={hhmm(draft.uhrzeitVon)} onChange={v => updateDraft(t.id, { uhrzeitVon: v })} />
                <LabeledInput type="time" label="Uhrzeit bis" value={hhmm(draft.uhrzeitBis)} onChange={v => updateDraft(t.id, { uhrzeitBis: v })} />
              </div>
            </div>

            <LabeledInput label="Ort" value={draft.ort ?? ''} onChange={v => updateDraft(t.id, { ort: v })} />
            <div>
              <label className="mb-1 block text-xs text-gray-400">Beschreibung</label>
              <textarea value={draft.beschreibung ?? ''} onChange={e => updateDraft(t.id, { beschreibung: e.target.value })} rows={3}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-green-500 focus:outline-none resize-y" />
            </div>

            <GruppeSelect value={draft.gitarrengruppeId ?? ''} onChange={v => updateDraft(t.id, { gitarrengruppeId: v })} gruppen={gruppen} />

            <label className="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" checked={draft.istUnterricht ?? false}
                onChange={e => updateDraft(t.id, { istUnterricht: e.target.checked })}
                className="h-4 w-4 accent-green-500 rounded" />
              <span className="text-sm text-gray-300">Ist ein Unterrichtstermin</span>
              <span className="text-xs text-gray-500">(überschreibt einen automatischen Termin dieser Gruppe am selben Tag)</span>
            </label>

            <div className={`rounded-lg border p-3 flex flex-col gap-2 ${draft.abgesagt ? 'border-red-500/20 bg-red-900/10' : 'border-white/5 bg-slate-800/40'}`}>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={draft.abgesagt ?? false}
                  onChange={e => updateDraft(t.id, { abgesagt: e.target.checked })}
                  className="h-4 w-4 accent-red-500 rounded" />
                <span className="text-sm font-medium text-red-400">Veranstaltung absagen</span>
              </label>
              {draft.abgesagt && (
                <LabeledInput label="Absagegrund (optional)" value={draft.absageGrund ?? ''}
                  onChange={v => updateDraft(t.id, { absageGrund: v })}
                  placeholder="z.B. Aufgrund der Hitzewelle muss das Konzert leider entfallen." />
              )}
            </div>

            <div className="flex gap-2 items-center">
              <button onClick={() => saveEdit(t.id)} disabled={saving === t.id}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">
                {saving === t.id ? 'Speichert…' : '✓ Speichern'}
              </button>
              <button onClick={() => deleteTermin(t.id)}
                className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/50 transition">
                🗑 Löschen
              </button>
              <button onClick={() => setExpanded(null)}
                className="ml-auto rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-slate-600 transition">
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Ferien-Sync ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4">
          <h3 className="text-sm font-bold text-white">🏖 NRW-Schulferien</h3>
          <p className="mt-0.5 text-xs text-gray-400">Unterricht fällt während der Schulferien automatisch aus – hier manuell aktualisieren.</p>
        </div>
        <div className="p-5 flex flex-wrap items-center gap-3">
          <button onClick={syncFerien} disabled={syncing}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">
            {syncing ? 'Synchronisiert…' : '🔄 Ferien jetzt synchronisieren'}
          </button>
          {syncMsg && (
            <span className={`rounded-lg px-3 py-1.5 text-sm ${syncMsg.ok ? 'bg-green-900/30 border border-green-500/20 text-green-400' : 'bg-red-900/30 border border-red-500/20 text-red-400'}`}>
              {syncMsg.text}
            </span>
          )}
        </div>
      </div>

      {/* ── Agenda ───────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4">
          <h3 className="text-sm font-bold text-white">🗓️ Termine</h3>
          <p className="mt-0.5 text-xs text-gray-400">Konzerte, Ausflüge, Unterricht & Sonstiges im gewählten Zeitraum.</p>
        </div>
        <div className="p-5 flex flex-col gap-4">
          {/* Zeitraum */}
          <div className="flex flex-wrap items-end gap-3">
            <LabeledInput type="date" label="Von" value={von} onChange={setVon} />
            <LabeledInput type="date" label="Bis" value={bis} onChange={setBis} />
            <div className="flex gap-1.5">
              <button onClick={() => { setVon(todayIso()); setBis(addDaysIso(todayIso(), 30)) }}
                className="rounded-lg bg-slate-700 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-slate-600 transition">30 Tage</button>
              <button onClick={() => { setVon(todayIso()); setBis(addDaysIso(todayIso(), 90)) }}
                className="rounded-lg bg-slate-700 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-slate-600 transition">3 Monate</button>
              <button onClick={() => { setVon(todayIso()); setBis(addDaysIso(todayIso(), 365)) }}
                className="rounded-lg bg-slate-700 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-slate-600 transition">1 Jahr</button>
            </div>
          </div>

          {/* Kategorie-Filter */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilter('alle')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                filter === 'alle' ? 'bg-green-900/40 border-green-500/40 text-green-400' : 'bg-slate-800 border-white/10 text-gray-400 hover:text-white'
              }`}>Alle</button>
            {KATEGORIEN.map(k => (
              <button key={k} onClick={() => setFilter(k)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  filter === k ? 'bg-green-900/40 border-green-500/40 text-green-400' : 'bg-slate-800 border-white/10 text-gray-400 hover:text-white'
                }`}>{KAT_INFO[k].icon} {KAT_INFO[k].label}</button>
            ))}
          </div>

          {/* Neuer Termin */}
          {!creating ? (
            <button type="button" onClick={() => { setNewDraft(emptyDraft()); setCreating(true) }}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-green-500/40 bg-green-900/10 py-2.5 text-sm text-green-400 hover:bg-green-900/20 hover:border-green-500/70 transition">
              + Neuer Termin
            </button>
          ) : (
            <div className="rounded-xl border border-green-500/30 bg-slate-900 p-3 flex flex-col gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Neuer Termin</p>
              <LabeledInput label="Titel" value={newDraft.titel ?? ''} onChange={v => setNewDraft(d => ({ ...d, titel: v }))} />
              <KategorieChips value={(newDraft.kategorie as KalenderKategorie) ?? 'sonstige'} onChange={k => setNewDraft(d => ({ ...d, kategorie: k }))} />
              <div className="grid grid-cols-2 gap-2">
                <LabeledInput type="date" label="Start" value={newDraft.startDatum ?? ''} onChange={v => setNewDraft(d => ({ ...d, startDatum: v }))} />
                <LabeledInput type="date" label="Ende (optional)" value={newDraft.endDatum ?? ''} onChange={v => setNewDraft(d => ({ ...d, endDatum: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <LabeledInput type="time" label="Uhrzeit von" value={newDraft.uhrzeitVon ?? ''} onChange={v => setNewDraft(d => ({ ...d, uhrzeitVon: v }))} />
                <LabeledInput type="time" label="Uhrzeit bis" value={newDraft.uhrzeitBis ?? ''} onChange={v => setNewDraft(d => ({ ...d, uhrzeitBis: v }))} />
              </div>
              <LabeledInput label="Ort" value={newDraft.ort ?? ''} onChange={v => setNewDraft(d => ({ ...d, ort: v }))} />
              <div>
                <label className="mb-1 block text-xs text-gray-400">Beschreibung</label>
                <textarea value={newDraft.beschreibung ?? ''} onChange={e => setNewDraft(d => ({ ...d, beschreibung: e.target.value }))} rows={2}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-green-500 focus:outline-none resize-y" />
              </div>
              <GruppeSelect value={newDraft.gitarrengruppeId ?? ''} onChange={v => setNewDraft(d => ({ ...d, gitarrengruppeId: v }))} gruppen={gruppen} />
              <label className="flex cursor-pointer items-center gap-2.5">
                <input type="checkbox" checked={newDraft.istUnterricht ?? false}
                  onChange={e => setNewDraft(d => ({ ...d, istUnterricht: e.target.checked }))}
                  className="h-4 w-4 accent-green-500 rounded" />
                <span className="text-sm text-gray-300">Ist ein Unterrichtstermin</span>
              </label>
              <div className="flex gap-2">
                <button onClick={createTermin} disabled={saving === '__new__'}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">
                  {saving === '__new__' ? 'Legt an…' : '✓ Anlegen'}
                </button>
                <button onClick={() => setCreating(false)}
                  className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-slate-600 transition">
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {/* Liste */}
          {loadingTermine && <p className="text-center text-sm text-gray-500 py-4">Lädt…</p>}
          {loadError && <p className="rounded-lg border border-red-500/30 bg-red-900/10 px-4 py-2 text-sm text-red-400">⚠ {loadError}</p>}
          {!loadingTermine && !loadError && groups.length === 0 && (
            <p className="text-center text-sm text-gray-600 py-4">Keine Termine im gewählten Zeitraum.</p>
          )}
          {!loadingTermine && groups.map(g => (
            <div key={g.key} className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mt-1">{g.label}</p>
              {g.items.map(renderTermin)}
            </div>
          ))}
        </div>
      </div>

      {/* ── Unterrichts-Ausnahmen ────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4">
          <h3 className="text-sm font-bold text-white">🚫 Unterrichts-Ausnahmen</h3>
          <p className="mt-0.5 text-xs text-gray-400">
            Einzelne Tage ohne Unterricht (z.B. Karneval) – unabhängig von den Schulferien.
            Gilt für eine einzelne Gruppe oder – ohne Auswahl – für alle Gruppen.
          </p>
        </div>
        <div className="p-5 flex flex-col gap-4">
          {ausnahmeMsg && <p className="rounded-lg bg-red-900/30 border border-red-500/20 px-4 py-2 text-sm text-red-400">{ausnahmeMsg}</p>}

          {ausnahmen.length === 0 ? (
            <p className="text-sm text-gray-600">Noch keine Ausnahmen angelegt.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {ausnahmen.map(a => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-white/8 bg-slate-800/50 px-3 py-2">
                  <span className="text-sm font-mono text-white">{isoToDe(a.datum)}</span>
                  <span className="flex-1 text-sm text-gray-300 truncate">{a.grund}</span>
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-gray-400 whitespace-nowrap">
                    {a.gitarrengruppeId ? (gruppeLabel(a.gitarrengruppeId) ?? 'Gruppe') : 'Alle Gruppen'}
                  </span>
                  <button onClick={() => deleteAusnahme(a.id)}
                    className="rounded px-2 py-1 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 transition">🗑</button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={addAusnahme} className="rounded-lg border border-white/8 bg-slate-800/40 p-3 flex flex-wrap items-end gap-3">
            <LabeledInput type="date" label="Datum" value={newAusnahme.datum} onChange={v => setNewAusnahme(a => ({ ...a, datum: v }))} />
            <div className="flex-1 min-w-[180px]">
              <LabeledInput label="Grund" value={newAusnahme.grund} onChange={v => setNewAusnahme(a => ({ ...a, grund: v }))} placeholder="z.B. Karneval" />
            </div>
            <div className="min-w-[220px]">
              <GruppeSelect value={newAusnahme.gitarrengruppeId} onChange={v => setNewAusnahme(a => ({ ...a, gitarrengruppeId: v }))} gruppen={gruppen} />
            </div>
            <button type="submit"
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition">
              + Ausnahme hinzufügen
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
