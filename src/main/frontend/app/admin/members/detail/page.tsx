'use client'
import { getApiBase } from '@/lib/api'

import React, { useEffect, useState, Suspense } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const API_BASE = getApiBase()

interface Member {
  id: string
  email: string
  username: string
  vorname: string
  nachname: string
  role: string
  istAktiv: boolean
  eintrittsdatum: string | null
  austrittsdatum: string | null
  gruppe: {
    id: string
    wochentag: string
    vonUhrzeit: string
    bisUhrzeit: string
    location?: { id: string; name: string; adresse: string; parkplatzInfo?: string }
  } | null
  monatsbeitragCents: number | null
  individuellerPreis: boolean
  naechsteAenderung: { gueltigAb: string; gruppeId: string | null; gruppeLabel: string; monatsbeitragCents: number | null } | null
  vertrag: { status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED'; startDate: string; amountCents: number } | null
}

interface HistoryEntry {
  id: string
  aenderungsTyp: string
  alterWert: string
  neuerWert: string
  timestamp: string
}

interface GruppenHistorieEntry {
  id: string
  gueltigAb: string
  gruppeId: string | null
  gruppeLabel: string
  monatsbeitragCents: number | null
  notiz: string | null
  zukuenftig: boolean
}

function euro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

interface Gruppe {
  id: string
  wochentag: string
  vonUhrzeit: string
  bisUhrzeit: string
  location?: { id: string; name: string }
}

function MemberDetailContent() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const memberId = searchParams.get('id')

  const [member, setMember] = useState<Member | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [gruppenHistorie, setGruppenHistorie] = useState<GruppenHistorieEntry[]>([])
  const [gruppen, setGruppen] = useState<Gruppe[]>([])
  const [selectedGruppe, setSelectedGruppe] = useState('')
  const [selectedRolle, setSelectedRolle] = useState('')
  const [beitragEuro, setBeitragEuro] = useState('')
  const [gueltigAb, setGueltigAb] = useState('')
  const [notiz, setNotiz] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { document.title = 'Mitglied – Schwalmtalzupfer' }, [])
  useEffect(() => {
    if (!loading && (!user || (user.role !== 'ROLE_ADMIN' && user.role !== 'ROLE_BOARD'))) {
      router.push('/')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user || (user.role !== 'ROLE_ADMIN' && user.role !== 'ROLE_BOARD') || !memberId) return

    fetch(`${API_BASE}/api/member/${memberId}`, { credentials: 'include' })
      .then(r => r.json()).then((data: Member) => {
        setMember(data)
        setSelectedGruppe(data.gruppe?.id ?? '')
        setSelectedRolle(data.role)
        setBeitragEuro(data.individuellerPreis && data.monatsbeitragCents != null ? (data.monatsbeitragCents / 100).toString() : '')
      })
    fetch(`${API_BASE}/api/member/${memberId}/history`, { credentials: 'include' })
      .then(r => r.json()).then(setHistory)
    fetch(`${API_BASE}/api/member/${memberId}/gruppen-historie`, { credentials: 'include' })
      .then(r => r.json()).then(setGruppenHistorie)
    fetch(`${API_BASE}/api/gruppen`, { credentials: 'include' })
      .then(r => r.json()).then(setGruppen)
  }, [user, memberId])

  const reloadAfterGruppenAenderung = async () => {
    if (!memberId) return
    const updated: Member = await fetch(`${API_BASE}/api/member/${memberId}`, { credentials: 'include' }).then(r => r.json())
    setMember(updated)
    const h = await fetch(`${API_BASE}/api/member/${memberId}/history`, { credentials: 'include' }).then(r => r.json())
    setHistory(h)
    const gh = await fetch(`${API_BASE}/api/member/${memberId}/gruppen-historie`, { credentials: 'include' }).then(r => r.json())
    setGruppenHistorie(gh)
  }

  const saveGruppe = async () => {
    if (!memberId) return
    setSaving(true)
    const monatsbeitragCents = beitragEuro.trim() ? Math.round(parseFloat(beitragEuro.replace(',', '.')) * 100) : null
    await fetch(`${API_BASE}/api/member/${memberId}/gruppe`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gruppeId: selectedGruppe,
        monatsbeitragCents,
        gueltigAb: gueltigAb || null,
        notiz: notiz || null,
      }),
    })
    await reloadAfterGruppenAenderung()
    setGueltigAb('')
    setNotiz('')
    setSaving(false)
    setMsg(gueltigAb ? `Änderung ab ${gueltigAb} gespeichert.` : 'Gruppe gespeichert.')
    setTimeout(() => setMsg(''), 2500)
  }

  const saveRolle = async () => {
    if (!memberId || user?.role !== 'ROLE_ADMIN') return
    setSaving(true)
    await fetch(`${API_BASE}/api/member/${memberId}/rolle`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rolle: selectedRolle }),
    })
    const updated: Member = await fetch(`${API_BASE}/api/member/${memberId}`, { credentials: 'include' }).then(r => r.json())
    setMember(updated)
    const h = await fetch(`${API_BASE}/api/member/${memberId}/history`, { credentials: 'include' }).then(r => r.json())
    setHistory(h)
    setSaving(false)
    setMsg('Rolle gespeichert.')
    setTimeout(() => setMsg(''), 2500)
  }

  if (loading || !member) return <div className="flex min-h-[60vh] items-center justify-center text-gray-400">Laden…</div>

  const roleLabel: Record<string, string> = {
    GUEST: 'Gast', MEMBER: 'Mitglied', BOARD: 'Vorstand', ADMIN: 'Administrator',
  }

  const displayName = [member.vorname, member.nachname].filter(Boolean).join(' ') || member.username || member.email

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{displayName}</h1>
        <Link href="/admin/members" className="text-sm text-gray-400 hover:text-white transition">← Zurück</Link>
      </div>

      {msg && <div className="mb-4 rounded-lg bg-green-900/30 px-4 py-2 text-sm text-green-400">{msg}</div>}

      {/* Basisdaten */}
      <div className="mb-6 rounded-xl border border-white/10 bg-slate-900 p-6 grid grid-cols-2 gap-4 text-sm">
        <div><p className="text-gray-400">E-Mail</p><p className="text-white">{member.email || '–'}</p></div>
        <div><p className="text-gray-400">Username</p><p className="text-white">{member.username || '–'}</p></div>
        <div>
          <p className="text-gray-400">Rolle</p>
          <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-gray-300">{roleLabel[member.role] ?? member.role}</span>
        </div>
        <div>
          <p className="text-gray-400">Status</p>
          {member.istAktiv
            ? <span className="rounded-full bg-green-900/40 px-2 py-0.5 text-xs text-green-400">Aktiv</span>
            : <span className="rounded-full bg-red-900/40 px-2 py-0.5 text-xs text-red-400">Archiviert</span>}
        </div>
        {member.eintrittsdatum && <div><p className="text-gray-400">Eintrittsdatum</p><p className="text-white">{member.eintrittsdatum}</p></div>}
        {member.austrittsdatum && <div><p className="text-gray-400">Austrittsdatum</p><p className="text-white">{member.austrittsdatum}</p></div>}
      </div>

      {/* Mitgliedsvertrag (read-only, nie Kartendaten) */}
      {member.vertrag && (
        <div className="mb-6 rounded-xl border border-white/10 bg-slate-900 p-6 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Vertragsstatus</p>
            <span className={`rounded-full px-2 py-0.5 text-xs ${
              member.vertrag.status === 'ACTIVE' ? 'bg-green-900/40 text-green-400' :
              member.vertrag.status === 'PAST_DUE' ? 'bg-yellow-900/40 text-yellow-300' :
              'bg-red-900/40 text-red-400'
            }`}>
              {{ ACTIVE: 'Aktiv', PAST_DUE: 'Zahlung ausstehend', CANCELLED: 'Gekündigt' }[member.vertrag.status]}
            </span>
          </div>
          <div><p className="text-gray-400">Beitrag</p><p className="text-white">{(member.vertrag.amountCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} / Monat</p></div>
          <div><p className="text-gray-400">Vertrag seit</p><p className="text-white">{member.vertrag.startDate}</p></div>
        </div>
      )}

      {/* Aktuelle Gitarrengruppe + Beitrag */}
      <div className="mb-6 rounded-xl border border-white/10 bg-slate-900 p-6">
        <h2 className="mb-3 text-lg font-semibold text-white">Gitarrenunterricht - aktuell</h2>
        {member.gruppe ? (
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div><p className="text-gray-400">Wochentag / Zeit</p><p className="text-white">{member.gruppe.wochentag}, {member.gruppe.vonUhrzeit}–{member.gruppe.bisUhrzeit} Uhr</p></div>
            <div>
              <p className="text-gray-400">Monatsbeitrag</p>
              <p className="text-white">
                {member.monatsbeitragCents != null ? euro(member.monatsbeitragCents) : '–'}
                {member.monatsbeitragCents != null && !member.individuellerPreis && <span className="ml-1 text-xs text-gray-500">(Preisgruppen-Satz)</span>}
                {member.individuellerPreis && <span className="ml-1 text-xs text-gray-500">(individuell)</span>}
              </p>
            </div>
            {member.gruppe.location && (
              <>
                <div><p className="text-gray-400">Ort</p><p className="text-white">{member.gruppe.location.name}</p></div>
                <div>
                  <p className="text-gray-400">Adresse</p>
                  {member.gruppe.location.adresse ? (
                    <a
                      href={member.gruppe.location.adresse.startsWith('http')
                        ? member.gruppe.location.adresse
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(member.gruppe.location.adresse)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-green-400 hover:text-green-300 font-medium transition"
                    >
                      {member.gruppe.location.adresse.startsWith('http') ? 'In Maps öffnen' : member.gruppe.location.adresse}
                    </a>
                  ) : <p className="text-white">–</p>}
                  {member.gruppe.location.parkplatzInfo && (
                    <p className="mt-1 text-xs text-gray-500">🅿️ {member.gruppe.location.parkplatzInfo}</p>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="mb-4 text-sm text-gray-500">Keiner Gruppe zugewiesen.</p>
        )}

        {member.naechsteAenderung && (
          <div className="mb-4 rounded-lg border border-yellow-500/20 bg-yellow-900/10 px-4 py-2.5 text-sm text-yellow-300">
            Ab <strong>{member.naechsteAenderung.gueltigAb}</strong>: {member.naechsteAenderung.gruppeLabel}
            {member.naechsteAenderung.monatsbeitragCents != null && <> · {euro(member.naechsteAenderung.monatsbeitragCents)}/Monat</>}
          </div>
        )}

        <h3 className="mb-2 text-sm font-semibold text-gray-300">Gruppe/Beitrag ändern</h3>
        <p className="mb-3 text-xs text-gray-500">
          Ohne Datum wirkt die Änderung sofort. Mit einem Datum in der Zukunft bleibt bis dahin die
          bisherige Gruppe/der bisherige Beitrag sichtbar - z.B. bei einem geplanten Wechsel.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="mb-1 block text-xs text-gray-400">Gruppe</label>
            <select
              value={selectedGruppe}
              onChange={e => setSelectedGruppe(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none"
            >
              <option value="">– Keine Gruppe –</option>
              {gruppen.map(g => (
                <option key={g.id} value={g.id}>
                  {g.wochentag} {g.vonUhrzeit}–{g.bisUhrzeit} {g.location ? `(${g.location.name})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Beitrag € (leer = Preisgruppen-Satz)</label>
            <input
              value={beitragEuro}
              onChange={e => setBeitragEuro(e.target.value)}
              placeholder="z.B. 23"
              inputMode="decimal"
              className="w-28 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Gültig ab (leer = sofort)</label>
            <input
              type="date"
              value={gueltigAb}
              onChange={e => setGueltigAb(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none"
            />
          </div>
          <button
            onClick={saveGruppe}
            disabled={saving}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition"
          >
            Speichern
          </button>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs text-gray-400">Notiz (optional, z.B. Anlass des Wechsels)</label>
          <input
            value={notiz}
            onChange={e => setNotiz(e.target.value)}
            placeholder="z.B. Zeit angepasst, älter geworden"
            className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none"
          />
        </div>

        {gruppenHistorie.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-gray-400">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Gültig ab</th>
                  <th className="px-4 py-2 text-left font-medium">Gruppe</th>
                  <th className="px-4 py-2 text-left font-medium">Beitrag</th>
                  <th className="px-4 py-2 text-left font-medium">Notiz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {gruppenHistorie.map(h => (
                  <tr key={h.id} className={h.zukuenftig ? 'bg-yellow-900/10 text-yellow-200' : 'bg-slate-900 text-gray-300'}>
                    <td className="px-4 py-2">{h.gueltigAb}{h.zukuenftig && <span className="ml-1.5 text-[10px] uppercase tracking-wide">geplant</span>}</td>
                    <td className="px-4 py-2">{h.gruppeLabel}</td>
                    <td className="px-4 py-2">{h.monatsbeitragCents != null ? euro(h.monatsbeitragCents) : '–'}</td>
                    <td className="px-4 py-2 text-gray-500">{h.notiz || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rolle ändern (nur ADMIN) */}
      {user?.role === 'ROLE_ADMIN' && (
        <div className="mb-6 rounded-xl border border-white/10 bg-slate-900 p-6">
          <h2 className="mb-3 text-lg font-semibold text-white">Rolle ändern</h2>
          <div className="flex gap-3">
            <select
              value={selectedRolle}
              onChange={e => setSelectedRolle(e.target.value)}
              className="flex-1 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none"
            >
              <option value="GUEST">Gast</option>
              <option value="MEMBER">Mitglied</option>
              <option value="BOARD">Vorstand</option>
              <option value="ADMIN">Administrator</option>
            </select>
            <button
              onClick={saveRolle}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition"
            >
              Speichern
            </button>
          </div>
        </div>
      )}

      {/* Änderungshistorie */}
      <div className="rounded-xl border border-white/10 bg-slate-900 p-6">
        <h2 className="mb-3 text-lg font-semibold text-white">Änderungshistorie</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Noch keine Änderungen protokolliert.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-white/10">
                  <th className="pb-2 pr-4">Typ</th>
                  <th className="pb-2 pr-4">Alter Wert</th>
                  <th className="pb-2 pr-4">Neuer Wert</th>
                  <th className="pb-2">Zeitstempel</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} className="border-b border-white/5 text-gray-300">
                    <td className="py-2 pr-4 font-medium text-white">{h.aenderungsTyp}</td>
                    <td className="py-2 pr-4">{h.alterWert ?? '–'}</td>
                    <td className="py-2 pr-4">{h.neuerWert ?? '–'}</td>
                    <td className="py-2 text-gray-500">{new Date(h.timestamp).toLocaleString('de-DE')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MemberDetailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center text-gray-400">Laden…</div>}>
      <MemberDetailContent />
    </Suspense>
  )
}

