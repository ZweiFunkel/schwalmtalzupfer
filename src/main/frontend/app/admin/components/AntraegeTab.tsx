'use client'
import { getApiBase } from '@/lib/api'
import { useCallback, useEffect, useState } from 'react'

const API_BASE = getApiBase()

interface Gruppe { id: string; wochentag: string; vonUhrzeit: string; bisUhrzeit: string }

interface Antrag {
  id: string
  antragstellerVorname: string
  antragstellerNachname: string
  email: string
  telefon: string | null
  fuerKind: boolean
  kindVorname: string | null
  kindNachname: string | null
  alterJahre: number | null
  gitarrenErfahrung: string | null
  status: 'NEU' | 'IN_KONTAKT' | 'ANGENOMMEN' | 'ABGELEHNT'
  boardNotiz: string | null
  createdAt: string
  gitarrengruppe?: { id: string; wochentag: string; vonUhrzeit: string; bisUhrzeit: string }
}

export default function AntraegeTab() {
  const [gruppen, setGruppen] = useState<Gruppe[]>([])
  const [antraege, setAntraege] = useState<Antrag[]>([])
  const [antragStatusFilter, setAntragStatusFilter] = useState<'ALLE' | Antrag['status']>('ALLE')
  const [antragNotizDraft, setAntragNotizDraft] = useState<Record<string, string>>({})
  const [antragGruppeDraft, setAntragGruppeDraft] = useState<Record<string, string>>({})

  const loadAntraege = useCallback(async () => {
    const query = antragStatusFilter !== 'ALLE' ? `?status=${antragStatusFilter}` : ''
    const res = await fetch(`${API_BASE}/api/beitritt${query}`, { credentials: 'include' })
    if (res.ok) setAntraege(await res.json())
  }, [antragStatusFilter])

  const loadGruppen = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/gruppen`, { credentials: 'include' })
    if (res.ok) setGruppen(await res.json())
  }, [])

  useEffect(() => { loadAntraege() }, [loadAntraege])
  useEffect(() => { loadGruppen() }, [loadGruppen])

  const patchAntrag = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE}/api/beitritt/${id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) loadAntraege()
    return res
  }

  const annehmenAntrag = async (id: string) => {
    if (!confirm('Antrag annehmen und Einladung mit Unterrichtsdetails & Preis verschicken?')) return
    const res = await fetch(`${API_BASE}/api/beitritt/${id}/annehmen`, { method: 'POST', credentials: 'include' })
    if (res.ok) loadAntraege()
    else { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Annahme fehlgeschlagen') }
  }

  const deleteAntrag = async (id: string) => {
    if (!confirm('Antrag wirklich löschen? Das kann nicht rückgängig gemacht werden.')) return
    const res = await fetch(`${API_BASE}/api/beitritt/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) loadAntraege()
    else alert('Löschen fehlgeschlagen')
  }

  const antragStatusLabel = (s: Antrag['status']) =>
    ({ NEU: 'Neu', IN_KONTAKT: 'In Kontakt', ANGENOMMEN: 'Angenommen', ABGELEHNT: 'Abgelehnt' }[s])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h3 className="font-semibold text-white">📝 Beitrittsanträge</h3>
            <p className="mt-1 text-xs text-gray-500">Anträge prüfen, Gruppe zuweisen, annehmen oder ablehnen</p>
          </div>
          <select value={antragStatusFilter} onChange={e => setAntragStatusFilter(e.target.value as any)}
            className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none">
            <option value="ALLE">Alle</option>
            <option value="NEU">Neu</option>
            <option value="IN_KONTAKT">In Kontakt</option>
            <option value="ANGENOMMEN">Angenommen</option>
            <option value="ABGELEHNT">Abgelehnt</option>
          </select>
        </div>
        <div className="p-6">
          {antraege.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 px-4 py-3 text-sm text-gray-500 text-center">
              Keine Anträge in dieser Ansicht.
            </p>
          ) : (
            <div className="space-y-4">
              {antraege.map(a => (
                <div key={a.id} className="rounded-lg border border-white/10 bg-slate-800/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">
                        {a.antragstellerVorname} {a.antragstellerNachname}
                        {a.fuerKind && <span className="ml-2 text-xs text-gray-400">für Kind: {a.kindVorname} {a.kindNachname}</span>}
                      </p>
                      <p className="text-xs text-gray-500">{a.email}{a.telefon ? ` · ${a.telefon}` : ''}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {a.alterJahre ? `${a.alterJahre} Jahre · ` : ''}
                        {a.gitarrenErfahrung || 'keine Angaben zur Erfahrung'}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      a.status === 'NEU' ? 'bg-blue-900/40 text-blue-300' :
                      a.status === 'IN_KONTAKT' ? 'bg-yellow-900/40 text-yellow-300' :
                      a.status === 'ANGENOMMEN' ? 'bg-green-900/40 text-green-300' :
                      'bg-red-900/40 text-red-300'
                    }`}>
                      {antragStatusLabel(a.status)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">Unterrichtsgruppe zuweisen</label>
                      <select
                        value={antragGruppeDraft[a.id] ?? a.gitarrengruppe?.id ?? ''}
                        onChange={e => {
                          setAntragGruppeDraft(prev => ({ ...prev, [a.id]: e.target.value }))
                          if (e.target.value) patchAntrag(a.id, { gitarrengruppeId: e.target.value })
                        }}
                        className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none">
                        <option value="">– wählen –</option>
                        {gruppen.map(g => (
                          <option key={g.id} value={g.id}>{g.wochentag} {g.vonUhrzeit}–{g.bisUhrzeit}</option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-[220px] flex-1">
                      <label className="mb-1 block text-xs text-gray-400">Vorstands-Notiz</label>
                      <input
                        value={antragNotizDraft[a.id] ?? a.boardNotiz ?? ''}
                        onChange={e => setAntragNotizDraft(prev => ({ ...prev, [a.id]: e.target.value }))}
                        onBlur={e => patchAntrag(a.id, { boardNotiz: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none" />
                    </div>
                    {a.status === 'NEU' && (
                      <button onClick={() => patchAntrag(a.id, { status: 'IN_KONTAKT' })}
                        className="rounded-lg bg-yellow-700/60 px-3 py-2 text-xs font-semibold text-yellow-200 hover:bg-yellow-700 transition">
                        Kontakt aufgenommen
                      </button>
                    )}
                    {a.status !== 'ABGELEHNT' && a.status !== 'ANGENOMMEN' && (a.gitarrengruppe || antragGruppeDraft[a.id]) && (
                      <button onClick={() => annehmenAntrag(a.id)}
                        className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-500 transition">
                        Annehmen
                      </button>
                    )}
                    {a.status !== 'ABGELEHNT' && a.status !== 'ANGENOMMEN' && (
                      <button onClick={() => { if (confirm('Antrag wirklich ablehnen?')) patchAntrag(a.id, { status: 'ABGELEHNT' }) }}
                        className="rounded-lg bg-red-900/40 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-900/70 transition">
                        Ablehnen
                      </button>
                    )}
                    <button onClick={() => deleteAntrag(a.id)}
                      className="rounded-lg border border-red-900/40 px-3 py-2 text-xs font-semibold text-red-400/80 hover:bg-red-900/40 hover:text-red-400 transition">
                      Löschen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
