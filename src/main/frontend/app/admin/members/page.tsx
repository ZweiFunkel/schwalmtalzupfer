'use client'
import { getApiBase } from '@/lib/api'

import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
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
  gruppe: {
    id: string
    wochentag: string
    vonUhrzeit: string
    bisUhrzeit: string
    location?: { id: string; name: string; adresse: string }
  } | null
}

export default function AdminMembersPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [fetching, setFetching] = useState(false)
  const [showArchive, setShowArchive] = useState(false)

  // Redirect if not admin/board
  useEffect(() => { document.title = 'Mitglieder – Schwalmtalzupfer' }, [])
  useEffect(() => {
    if (!loading && (!user || (user.role !== 'ROLE_ADMIN' && user.role !== 'ROLE_CHEF'))) {
      router.push('/')
    }
  }, [user, loading, router])

  // Debounce Suche
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchMembers = useCallback(async () => {
    setFetching(true)
    const params = debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ''
    const res = await fetch(`${API_BASE}/api/member${params}`, { credentials: 'include' })
    if (res.ok) {
      setMembers(await res.json())
    }
    setFetching(false)
  }, [debouncedSearch])

  useEffect(() => {
    if (user && (user.role === 'ROLE_ADMIN' || user.role === 'ROLE_CHEF')) {
      fetchMembers()
    }
  }, [user, fetchMembers])

  const toggleAktiv = async (member: Member) => {
    const endpoint = member.istAktiv ? 'deaktivieren' : 'reaktivieren'
    await fetch(`${API_BASE}/api/member/${member.id}/${endpoint}`, {
      method: 'PATCH',
      credentials: 'include',
    })
    fetchMembers()
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-gray-400">Laden…</div>
  if (!user) return null

  const roleLabel: Record<string, string> = {
    GUEST: 'Gast', MEMBER: 'Mitglied', BOARD: 'Vorstand', CHEF: 'Chef', ADMIN: 'Administrator',
  }

  const filtered = members.filter(m => showArchive ? !m.istAktiv : m.istAktiv)

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Mitgliederverwaltung</h1>
        <Link href="/admin" className="text-sm text-gray-400 hover:text-white transition">← Zurück zum Admin</Link>
      </div>

      {/* Suche & Filter */}
      <div className="mb-4 flex gap-3 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Suche nach Vorname, Nachname, Username…"
          className="flex-1 min-w-[220px] rounded-lg border border-white/10 bg-slate-800 px-4 py-2 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
        />
        <button
          onClick={() => setShowArchive(v => !v)}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            showArchive ? 'bg-amber-600 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
          }`}
        >
          {showArchive ? 'Archiv anzeigen' : 'Aktive anzeigen'}
        </button>
      </div>

      {/* Tabelle */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-gray-400 text-left">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">E-Mail</th>
              <th className="px-4 py-3">Rolle</th>
              <th className="px-4 py-3">Gruppe</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {fetching && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">Laden…</td></tr>
            )}
            {!fetching && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">Keine Mitglieder gefunden.</td></tr>
            )}
            {filtered.map(m => (
              <tr key={m.id} className="border-b border-white/5 hover:bg-slate-800/50 transition">
                <td className="px-4 py-3 text-white font-medium">
                  {[m.vorname, m.nachname].filter(Boolean).join(' ') || '–'}
                </td>
                <td className="px-4 py-3 text-gray-300">{m.username || '–'}</td>
                <td className="px-4 py-3 text-gray-300">{m.email || '–'}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-gray-300">
                    {roleLabel[m.role] ?? m.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300">
                  {m.gruppe
                    ? `${m.gruppe.wochentag} ${m.gruppe.vonUhrzeit}–${m.gruppe.bisUhrzeit}`
                    : <span className="text-gray-600">–</span>}
                </td>
                <td className="px-4 py-3">
                  {m.istAktiv
                    ? <span className="rounded-full bg-green-900/40 px-2 py-0.5 text-xs text-green-400">Aktiv</span>
                    : <span className="rounded-full bg-red-900/40 px-2 py-0.5 text-xs text-red-400">Archiviert</span>}
                </td>
                <td className="px-4 py-3 flex gap-2">
                  <Link href={`/admin/members/detail?id=${m.id}`}
                    className="rounded bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-600 transition">
                    Details
                  </Link>
                  <button
                    onClick={() => toggleAktiv(m)}
                    className={`rounded px-2 py-1 text-xs transition ${
                      m.istAktiv
                        ? 'bg-red-900/40 text-red-400 hover:bg-red-900/70'
                        : 'bg-green-900/40 text-green-400 hover:bg-green-900/70'
                    }`}
                  >
                    {m.istAktiv ? 'Deaktivieren' : 'Reaktivieren'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

