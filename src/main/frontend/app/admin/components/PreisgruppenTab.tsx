'use client'
import { getApiBase } from '@/lib/api'
import React, { useCallback, useEffect, useState } from 'react'

const API_BASE = getApiBase()

interface PriceRate { id: string; amountCents: number; validFrom: string; createdAt: string }
interface PriceGroup { id: string; name: string; description: string | null; currentRate?: PriceRate }

export default function PreisgruppenTab() {
  const [priceGroups, setPriceGroups] = useState<PriceGroup[]>([])
  const [priceGroupsMsg, setPriceGroupsMsg] = useState('')
  const [newPriceGroup, setNewPriceGroup] = useState({ name: '', description: '' })
  const [rateHistory, setRateHistory] = useState<Record<string, PriceRate[]>>({})
  const [newRate, setNewRate] = useState<Record<string, { amountEuro: string; validFrom: string }>>({})

  const loadPriceGroups = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/pricing/groups`, { credentials: 'include' })
    if (res.ok) setPriceGroups(await res.json())
  }, [])

  useEffect(() => { loadPriceGroups() }, [loadPriceGroups])

  const createPriceGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPriceGroup.name.trim()) return
    const res = await fetch(`${API_BASE}/api/pricing/groups`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPriceGroup),
    })
    if (res.ok) { setNewPriceGroup({ name: '', description: '' }); loadPriceGroups() }
    else { const d = await res.json().catch(() => ({})); setPriceGroupsMsg(d.error ?? 'Fehler beim Erstellen') }
  }

  const deletePriceGroup = async (id: string) => {
    if (!confirm('Preisgruppe wirklich löschen?')) return
    const res = await fetch(`${API_BASE}/api/pricing/groups/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) loadPriceGroups()
    else { const d = await res.json().catch(() => ({})); setPriceGroupsMsg(d.error ?? 'Löschen fehlgeschlagen') }
  }

  const fetchRates = async (groupId: string): Promise<PriceRate[]> => {
    const res = await fetch(`${API_BASE}/api/pricing/groups/${groupId}/rates`, { credentials: 'include' })
    return res.ok ? res.json() : []
  }

  const toggleRateHistory = async (groupId: string) => {
    if (rateHistory[groupId]) {
      setRateHistory(prev => { const next = { ...prev }; delete next[groupId]; return next })
      return
    }
    const rates = await fetchRates(groupId)
    setRateHistory(prev => ({ ...prev, [groupId]: rates }))
  }

  const addRate = async (groupId: string) => {
    const draft = newRate[groupId]
    if (!draft || !draft.amountEuro || !draft.validFrom) return
    const amountCents = Math.round(parseFloat(draft.amountEuro.replace(',', '.')) * 100)
    if (!Number.isFinite(amountCents) || amountCents <= 0) return
    const res = await fetch(`${API_BASE}/api/pricing/groups/${groupId}/rates`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents, validFrom: draft.validFrom }),
    })
    if (res.ok) {
      setNewRate(prev => ({ ...prev, [groupId]: { amountEuro: '', validFrom: '' } }))
      loadPriceGroups()
      if (rateHistory[groupId]) {
        const rates = await fetchRates(groupId)
        setRateHistory(prev => ({ ...prev, [groupId]: rates }))
      }
    }
  }

  const formatEuro = (cents: number) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4">
          <h3 className="font-semibold text-white">💶 Preisgruppen</h3>
          <p className="mt-1 text-xs text-gray-500">Beiträge pro Gruppen-Kategorie, historisiert nach "gültig ab"</p>
        </div>
        <div className="p-6">
          {priceGroupsMsg && (
            <p className="mb-4 rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-400">{priceGroupsMsg}</p>
          )}
          {priceGroups.length > 0 ? (
            <div className="mb-5 space-y-3">
              {priceGroups.map(pg => (
                <div key={pg.id} className="rounded-lg border border-white/10 bg-slate-800/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{pg.name}</p>
                      {pg.description && <p className="text-xs text-gray-500">{pg.description}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-green-400">
                        {pg.currentRate ? `${formatEuro(pg.currentRate.amountCents)} / Monat` : 'kein Preis hinterlegt'}
                      </span>
                      <button onClick={() => toggleRateHistory(pg.id)}
                        className="rounded px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-gray-300 transition">
                        {rateHistory[pg.id] ? 'Historie ausblenden' : 'Historie'}
                      </button>
                      <button onClick={() => deletePriceGroup(pg.id)}
                        className="rounded px-2 py-1 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 transition">
                        Löschen
                      </button>
                    </div>
                  </div>

                  {rateHistory[pg.id] && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-800 text-gray-400">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Gültig ab</th>
                            <th className="px-3 py-2 text-left font-medium">Betrag</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {rateHistory[pg.id].length === 0 ? (
                            <tr><td colSpan={2} className="px-3 py-2 text-gray-500 italic">Noch keine Preise hinterlegt.</td></tr>
                          ) : rateHistory[pg.id].map(r => (
                            <tr key={r.id} className="bg-slate-900">
                              <td className="px-3 py-2 text-gray-300">{r.validFrom}</td>
                              <td className="px-3 py-2 text-gray-300">{formatEuro(r.amountCents)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">Neuer Preis (€/Monat)</label>
                      <input value={newRate[pg.id]?.amountEuro ?? ''} placeholder="z.B. 15,00"
                        onChange={e => setNewRate(prev => ({ ...prev, [pg.id]: { amountEuro: e.target.value, validFrom: prev[pg.id]?.validFrom ?? '' } }))}
                        className="w-28 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">Gültig ab</label>
                      <input type="date" value={newRate[pg.id]?.validFrom ?? ''}
                        onChange={e => setNewRate(prev => ({ ...prev, [pg.id]: { amountEuro: prev[pg.id]?.amountEuro ?? '', validFrom: e.target.value } }))}
                        className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
                    </div>
                    <button onClick={() => addRate(pg.id)}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition">
                      + Preis hinzufügen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-5 rounded-lg border border-dashed border-white/10 px-4 py-3 text-sm text-gray-500 text-center">
              Noch keine Preisgruppen angelegt.
            </p>
          )}

          <div className="rounded-lg border border-white/10 bg-slate-800/40 p-4">
            <p className="mb-3 text-xs font-semibold text-gray-300">+ Neue Preisgruppe anlegen</p>
            <form onSubmit={createPriceGroup} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="mb-1 block text-xs text-gray-400">Name *</label>
                <input value={newPriceGroup.name} onChange={e => setNewPriceGroup(p => ({ ...p, name: e.target.value }))}
                  placeholder="z.B. Orchester" required
                  className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Beschreibung (optional)</label>
                <input value={newPriceGroup.description} onChange={e => setNewPriceGroup(p => ({ ...p, description: e.target.value }))}
                  placeholder="z.B. für Mitglieder im Orchester"
                  className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
              </div>
              <button type="submit"
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition">
                + Anlegen
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
