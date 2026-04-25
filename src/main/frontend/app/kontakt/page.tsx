'use client'
import { getApiBase } from '@/lib/api'

import React, { useState } from 'react'

const API_BASE = getApiBase()

export default function KontaktPage() {
  const [betreff, setBetreff] = useState('')
  const [email, setEmail] = useState('')
  const [nachricht, setNachricht] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const mailtoText = `An: info@schwalmtalzupfer.de\nBetreff: ${betreff}\nVon: ${email}\n\n${nachricht}`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(mailtoText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betreff, email, nachricht }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Fehler beim Senden. Bitte versuche es später erneut.')
      } else {
        setSent(true)
        setBetreff('')
        setEmail('')
        setNachricht('')
      }
    } catch {
      setError('Netzwerkfehler. Bitte prüfe deine Verbindung.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold text-white">Kontakt</h1>
      <p className="mb-8 text-gray-400">
        Du hast eine Frage oder möchtest uns etwas mitteilen? Schreib uns – wir melden uns so schnell wie möglich.
      </p>

      {sent ? (
        <div className="rounded-xl border border-green-500/30 bg-green-900/20 p-6 text-center">
          <p className="text-2xl mb-2">✓</p>
          <p className="text-green-400 font-semibold">Nachricht erfolgreich gesendet!</p>
          <p className="text-sm text-gray-400 mt-1">Wir werden uns bald bei dir melden.</p>
          <button
            onClick={() => setSent(false)}
            className="mt-4 text-sm text-green-400 underline hover:text-green-300"
          >
            Weitere Nachricht senden
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm text-gray-400">Deine E-Mail-Adresse *</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="deine@email.de"
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Betreff *</label>
            <input
              type="text"
              value={betreff}
              onChange={e => setBetreff(e.target.value)}
              required
              placeholder="Worum geht es?"
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Nachricht *</label>
            <textarea
              value={nachricht}
              onChange={e => setNachricht(e.target.value)}
              required
              rows={6}
              placeholder="Deine Nachricht…"
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none resize-none"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-900/30 border border-red-500/30 px-3 py-2 text-sm text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={sending}
            className="rounded-lg bg-green-600 py-2.5 font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition"
          >
            {sending ? 'Wird gesendet…' : 'Nachricht senden'}
          </button>

          {/* Kopier-Fallback: sobald E-Mail ausgefüllt */}
          {email && (
            <div className="mt-2 rounded-xl border border-yellow-500/20 bg-yellow-900/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-yellow-400">📋 Alternativ: Nachricht kopieren</p>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="rounded-lg border border-yellow-500/30 bg-yellow-900/20 px-3 py-1 text-xs font-medium text-yellow-300 hover:bg-yellow-800/30 transition"
                >
                  {copied ? '✓ Kopiert!' : 'Kopieren'}
                </button>
              </div>
              <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-950/60 p-3 text-xs text-gray-300 font-mono select-all">
                {mailtoText}
              </pre>
              <a
                href={`mailto:info@schwalmtalzupfer.de?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(`Von: ${email}\n\n${nachricht}`)}`}
                className="mt-2 block text-center rounded-lg border border-yellow-500/30 bg-yellow-900/20 py-2 text-xs text-yellow-300 hover:bg-yellow-800/30 transition"
              >
                ✉️ In E-Mail-Programm öffnen
              </a>
            </div>
          )}
        </form>
      )}

    </div>
  )
}

