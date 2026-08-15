'use client'
import { getApiBase } from '@/lib/api'

import React, { useEffect, useState } from 'react'

const API_BASE = getApiBase()

const inputClass = 'w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-green-500 focus:outline-none'
const labelClass = 'mb-1 block text-sm text-gray-600 dark:text-gray-400'

export default function BeitrittPage() {
  const [antragstellerVorname, setAntragstellerVorname] = useState('')
  const [antragstellerNachname, setAntragstellerNachname] = useState('')
  const [email, setEmail] = useState('')
  const [telefon, setTelefon] = useState('')
  const [fuerKind, setFuerKind] = useState(false)
  const [kindVorname, setKindVorname] = useState('')
  const [kindNachname, setKindNachname] = useState('')
  const [alterJahre, setAlterJahre] = useState('')
  const [gitarrenErfahrung, setGitarrenErfahrung] = useState('')

  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { document.title = 'Beitreten – Schwalmtalzupfer' }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/beitritt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          antragstellerVorname,
          antragstellerNachname,
          email,
          telefon: telefon || undefined,
          fuerKind,
          kindVorname: fuerKind ? kindVorname : undefined,
          kindNachname: fuerKind ? kindNachname : undefined,
          alterJahre: alterJahre ? Number(alterJahre) : undefined,
          gitarrenErfahrung: gitarrenErfahrung || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Fehler beim Senden. Bitte versuche es später erneut.')
      } else {
        setSent(true)
      }
    } catch {
      setError('Netzwerkfehler. Bitte prüfe deine Verbindung.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Verein beitreten</h1>
      <p className="mb-8 text-gray-500 dark:text-gray-400">
        Stell hier deinen Beitrittsantrag – der Vorstand meldet sich anschließend bei dir mit den Details zu Unterrichtsgruppe und Beitrag.
      </p>

      {sent ? (
        <div className="rounded-xl border border-green-500/30 bg-green-50 dark:bg-green-900/20 p-6 text-center">
          <p className="text-2xl mb-2">✓</p>
          <p className="text-green-700 dark:text-green-400 font-semibold">Antrag erfolgreich gesendet!</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Der Vorstand meldet sich in Kürze bei dir.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Vorname *</label>
              <input value={antragstellerVorname} onChange={e => setAntragstellerVorname(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Nachname *</label>
              <input value={antragstellerNachname} onChange={e => setAntragstellerNachname(e.target.value)} required className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>E-Mail *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="deine@email.de" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Telefon (optional)</label>
              <input type="tel" value={telefon} onChange={e => setTelefon(e.target.value)} className={inputClass} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={fuerKind} onChange={e => setFuerKind(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Der Antrag ist für mein Kind
          </label>

          {fuerKind && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 dark:border-white/10 p-4">
              <div>
                <label className={labelClass}>Vorname des Kindes *</label>
                <input value={kindVorname} onChange={e => setKindVorname(e.target.value)} required={fuerKind} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Nachname des Kindes *</label>
                <input value={kindNachname} onChange={e => setKindNachname(e.target.value)} required={fuerKind} className={inputClass} />
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>Alter (der Person, die Unterricht nimmt)</label>
            <input type="number" min={1} max={120} value={alterJahre} onChange={e => setAlterJahre(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Gitarrenerfahrung (optional)</label>
            <textarea value={gitarrenErfahrung} onChange={e => setGitarrenErfahrung(e.target.value)} rows={4}
              placeholder="z.B. keine Vorkenntnisse, 2 Jahre Unterricht, ..." className={`${inputClass} resize-none`} />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-500/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button type="submit" disabled={sending}
            className="rounded-lg bg-green-600 py-2.5 font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">
            {sending ? 'Wird gesendet…' : 'Antrag senden'}
          </button>
        </form>
      )}
    </div>
  )
}
