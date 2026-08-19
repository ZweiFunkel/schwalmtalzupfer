'use client'
import { getApiBase } from '@/lib/api'
import React, { useCallback, useEffect, useState } from 'react'
import { isChef, isBoard, type AuthUser } from '@/lib/auth'

const API_BASE = getApiBase()

interface Gruppe { id: string; wochentag: string; vonUhrzeit: string; bisUhrzeit: string; location?: { id: string; name: string; adresse: string }; priceGroup?: { id: string; name: string } }
interface Loc { id: string; name: string; adresse: string; parkplatzInfo?: string }
interface PriceRate { id: string; amountCents: number; validFrom: string; createdAt: string }
interface PriceGroup { id: string; name: string; description: string | null; currentRate?: PriceRate }

export default function MembersTab({ user }: { user: AuthUser }) {
  // Einladung
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRolle, setInviteRolle] = useState('MEMBER')
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [inviteTokenCopied, setInviteTokenCopied] = useState(false)
  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteToken(null)
    const res = await fetch(`${API_BASE}/api/invitation/invite`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, rolle: inviteRolle }),
    })
    const data = await res.json()
    setInviteMsg(data.message || data.error || 'Fehler')
    if (res.ok) {
      setInviteEmail('')
      if (data.token) setInviteToken(data.token)
    }
    setTimeout(() => setInviteMsg(''), 6000)
  }
  const copyInviteToken = () => {
    if (!inviteToken) return
    const url = `${window.location.origin}/register?token=${inviteToken}`
    navigator.clipboard.writeText(url).then(() => {
      setInviteTokenCopied(true)
      setTimeout(() => setInviteTokenCopied(false), 2000)
    })
  }

  // Gruppen & Locations
  const [gruppen, setGruppen] = useState<Gruppe[]>([])
  const [locations, setLocations] = useState<Loc[]>([])
  const [gruppenMsg, setGruppenMsg] = useState('')
  const [newGruppe, setNewGruppe] = useState({ locationId: '', vonUhrzeit: '', bisUhrzeit: '', wochentag: '', priceGroupId: '' })
  const [newLocation, setNewLocation] = useState({ name: '', adresse: '', parkplatzInfo: '' })
  const [parkplatzDraft, setParkplatzDraft] = useState<Record<string, string>>({})

  // Preisgruppen (nur lesend, für die Zuweisung in der Gruppen-Tabelle)
  const [priceGroups, setPriceGroups] = useState<PriceGroup[]>([])

  const loadPriceGroups = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/pricing/groups`, { credentials: 'include' })
    if (res.ok) setPriceGroups(await res.json())
  }, [])

  const loadGruppen = useCallback(async () => {
    const [gr, lo] = await Promise.all([
      fetch(`${API_BASE}/api/gruppen`, { credentials: 'include' }),
      fetch(`${API_BASE}/api/locations`, { credentials: 'include' }),
    ])
    if (gr.ok) setGruppen(await gr.json())
    if (lo.ok) setLocations(await lo.json())
    loadPriceGroups()
  }, [loadPriceGroups])

  useEffect(() => { loadGruppen() }, [loadGruppen])

  const createGruppe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGruppe.locationId || !newGruppe.vonUhrzeit || !newGruppe.bisUhrzeit || !newGruppe.wochentag || !newGruppe.priceGroupId) return
    const res = await fetch(`${API_BASE}/api/gruppen`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newGruppe),
    })
    if (res.ok) { setNewGruppe({ locationId: '', vonUhrzeit: '', bisUhrzeit: '', wochentag: '', priceGroupId: '' }); loadGruppen() }
    else { const d = await res.json().catch(() => ({})); setGruppenMsg(d.error ?? 'Fehler beim Erstellen') }
  }

  const updateGruppePreisgruppe = async (gruppeId: string, priceGroupId: string) => {
    const res = await fetch(`${API_BASE}/api/gruppen/${gruppeId}/preisgruppe`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceGroupId }),
    })
    if (res.ok) loadGruppen()
  }

  const deleteGruppe = async (id: string) => {
    if (!confirm('Gruppe wirklich löschen?')) return
    await fetch(`${API_BASE}/api/gruppen/${id}`, { method: 'DELETE', credentials: 'include' })
    loadGruppen()
  }

  const createLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLocation.name) return
    const res = await fetch(`${API_BASE}/api/locations`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLocation),
    })
    if (res.ok) { setNewLocation({ name: '', adresse: '', parkplatzInfo: '' }); loadGruppen() }
  }

  const deleteLocation = async (id: string) => {
    if (!confirm('Location wirklich löschen?')) return
    await fetch(`${API_BASE}/api/locations/${id}`, { method: 'DELETE', credentials: 'include' })
    loadGruppen()
  }

  const updateLocationParkplatz = async (id: string, parkplatzInfo: string) => {
    await fetch(`${API_BASE}/api/locations/${id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parkplatzInfo }),
    })
    loadGruppen()
  }

  return (
    <>
      {/* Link zur Mitgliederverwaltung (nur Chef/Admin - kümmern sich um die Mitglieder) */}
      {isChef(user) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a href="/admin/members"
            className="group flex items-center gap-4 rounded-xl border border-white/10 bg-slate-900 p-5 hover:border-green-500/40 hover:bg-slate-800/60 transition">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-green-900/30 text-2xl">👥</div>
            <div>
              <p className="font-semibold text-white group-hover:text-green-400 transition">Mitglieder verwalten</p>
              <p className="mt-0.5 text-xs text-gray-400">Suchen, deaktivieren, Gruppen zuweisen, Verlauf</p>
            </div>
            <span className="ml-auto text-gray-500 group-hover:text-green-400 transition text-lg">→</span>
          </a>
        </div>
      )}

      {/* Einladungsformular (nur Vorstand/Admin) */}
      {isBoard(user) && (
      <div className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4">
          <h3 className="font-semibold text-white">✉️ Mitglied einladen</h3>
          <p className="mt-0.5 text-xs text-gray-400">Sendet einen Einladungslink per E-Mail. BOARD kann nur MEMBER und BOARD einladen.</p>
        </div>
        <div className="p-6">
          {inviteMsg && <div className={`mb-4 rounded-lg px-4 py-2.5 text-sm ${inviteMsg.includes('verschickt') ? 'bg-green-900/30 border border-green-500/20 text-green-400' : 'bg-red-900/30 border border-red-500/20 text-red-400'}`}>{inviteMsg}</div>}
          <form onSubmit={sendInvite} className="flex flex-wrap gap-3">
            <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="E-Mail-Adresse"
              className="flex-1 min-w-[200px] rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none" />
            <select value={inviteRolle} onChange={e => setInviteRolle(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none">
              <option value="MEMBER">Mitglied</option>
              <option value="BOARD">Vorstand</option>
              {user.role === 'ROLE_ADMIN' && <option value="CHEF">Chef</option>}
              {user.role === 'ROLE_ADMIN' && <option value="ADMIN">Administrator</option>}
            </select>
            <button type="submit"
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition">
              Einladung senden
            </button>
          </form>
          {inviteToken && (
            <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-900/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-yellow-400">📋 Einladungslink (Fallback, falls Mail nicht ankam)</p>
                <button type="button" onClick={copyInviteToken}
                  className="rounded-lg border border-yellow-500/30 bg-yellow-900/20 px-3 py-1 text-xs font-medium text-yellow-300 hover:bg-yellow-800/30 transition">
                  {inviteTokenCopied ? '✓ Kopiert!' : 'Link kopieren'}
                </button>
              </div>
              <code className="block break-all rounded-lg bg-slate-950/60 p-3 text-xs text-gray-300 font-mono select-all">
                {`${typeof window !== 'undefined' ? window.location.origin : ''}/register?token=${inviteToken}`}
              </code>
              <p className="mt-2 text-xs text-gray-500">Diesen Link manuell weitergeben, falls die E-Mail nicht ankam.</p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Gitarrengruppen */}
      <div className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4">
          <h3 className="font-semibold text-white">🎸 Gitarrengruppen</h3>
        </div>
        <div className="p-6">
          {gruppenMsg && <p className="mb-3 rounded-lg bg-red-900/30 border border-red-500/20 px-4 py-2 text-sm text-red-400">{gruppenMsg}</p>}

          {gruppen.length > 0 ? (
            <div className="mb-5 overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-gray-400">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Wochentag</th>
                    <th className="px-4 py-2.5 text-left font-medium">Zeit</th>
                    <th className="px-4 py-2.5 text-left font-medium">Location</th>
                    <th className="px-4 py-2.5 text-left font-medium">Preisgruppe</th>
                    <th className="px-4 py-2.5 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {gruppen.map(g => (
                    <tr key={g.id} className="bg-slate-900 hover:bg-slate-800/60 transition">
                      <td className="px-4 py-2.5 text-white font-medium">{g.wochentag}</td>
                      <td className="px-4 py-2.5 text-gray-300">{g.vonUhrzeit} – {g.bisUhrzeit} Uhr</td>
                      <td className="px-4 py-2.5 text-gray-300">{g.location?.name ?? <span className="text-gray-600 italic">–</span>}</td>
                      <td className="px-4 py-2.5">
                        <select value={g.priceGroup?.id ?? ''} onChange={e => updateGruppePreisgruppe(g.id, e.target.value)}
                          className="rounded-lg border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white focus:border-green-500 focus:outline-none">
                          {priceGroups.map(pg => <option key={pg.id} value={pg.id}>{pg.name}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => deleteGruppe(g.id)}
                          className="rounded px-2 py-1 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 transition">
                          Löschen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mb-5 rounded-lg border border-dashed border-white/10 px-4 py-3 text-sm text-gray-500 text-center">
              Noch keine Gruppen angelegt.
            </p>
          )}

          <div className="rounded-lg border border-white/10 bg-slate-800/40 p-4">
            <p className="mb-3 text-xs font-semibold text-gray-300">+ Neue Gruppe anlegen</p>
            <form onSubmit={createGruppe} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="mb-1 block text-xs text-gray-400">Wochentag</label>
                <select value={newGruppe.wochentag} onChange={e => setNewGruppe(p => ({ ...p, wochentag: e.target.value }))}
                  className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none">
                  <option value="">– wählen –</option>
                  {['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Von</label>
                <input type="time" value={newGruppe.vonUhrzeit} onChange={e => setNewGruppe(p => ({ ...p, vonUhrzeit: e.target.value }))}
                  className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Bis</label>
                <input type="time" value={newGruppe.bisUhrzeit} onChange={e => setNewGruppe(p => ({ ...p, bisUhrzeit: e.target.value }))}
                  className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Location</label>
                <select value={newGruppe.locationId} onChange={e => setNewGruppe(p => ({ ...p, locationId: e.target.value }))}
                  className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none">
                  <option value="">– wählen –</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Preisgruppe</label>
                <select value={newGruppe.priceGroupId} onChange={e => setNewGruppe(p => ({ ...p, priceGroupId: e.target.value }))}
                  className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none">
                  <option value="">– wählen –</option>
                  {priceGroups.map(pg => <option key={pg.id} value={pg.id}>{pg.name}</option>)}
                </select>
              </div>
              <button type="submit"
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition">
                + Anlegen
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Locations */}
      <div className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4">
          <h3 className="font-semibold text-white">📍 Locations</h3>
        </div>
        <div className="p-6">
          {locations.length > 0 ? (
            <div className="mb-5 overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-gray-400">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Name</th>
                    <th className="px-4 py-2.5 text-left font-medium">Adresse</th>
                    <th className="px-4 py-2.5 text-left font-medium">Parkplatz-Hinweis</th>
                    <th className="px-4 py-2.5 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {locations.map(l => (
                    <tr key={l.id} className="bg-slate-900 hover:bg-slate-800/60 transition">
                      <td className="px-4 py-2.5 text-white font-medium">{l.name}</td>
                      <td className="px-4 py-2.5 text-gray-300">{l.adresse || <span className="text-gray-600 italic">–</span>}</td>
                      <td className="px-4 py-2.5">
                        <input
                          value={parkplatzDraft[l.id] ?? l.parkplatzInfo ?? ''}
                          onChange={e => setParkplatzDraft(p => ({ ...p, [l.id]: e.target.value }))}
                          onBlur={e => updateLocationParkplatz(l.id, e.target.value)}
                          placeholder="z.B. Parkplatz hinter der Kirche"
                          className="w-full rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1.5 text-xs text-white focus:border-green-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => deleteLocation(l.id)}
                          className="rounded px-2 py-1 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 transition">
                          Löschen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mb-5 rounded-lg border border-dashed border-white/10 px-4 py-3 text-sm text-gray-500 text-center">
              Noch keine Locations angelegt.
            </p>
          )}

          <div className="rounded-lg border border-white/10 bg-slate-800/40 p-4">
            <p className="mb-3 text-xs font-semibold text-gray-300">+ Neue Location anlegen</p>
            <form onSubmit={createLocation} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="mb-1 block text-xs text-gray-400">Name *</label>
                <input value={newLocation.name} onChange={e => setNewLocation(p => ({ ...p, name: e.target.value }))}
                  placeholder="z.B. Gemeindehaus" required
                  className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Adresse (optional)</label>
                <input value={newLocation.adresse} onChange={e => setNewLocation(p => ({ ...p, adresse: e.target.value }))}
                  placeholder="Musterstr. 1, 12345 Ort"
                  className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Parkplatz-Hinweis (optional)</label>
                <input value={newLocation.parkplatzInfo} onChange={e => setNewLocation(p => ({ ...p, parkplatzInfo: e.target.value }))}
                  placeholder="z.B. Parkplatz hinter der Kirche"
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
    </>
  )
}
