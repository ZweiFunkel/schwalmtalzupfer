'use client'
import { T, L } from '@/lib/i18n/LanguageProvider'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  useEffect(() => { document.title = 'Login – Schwalmtalzupfer' }, [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      router.push('/intern')
    } catch (err: any) {
      setError(err.message ?? 'Login fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">𝄞</div>
          <h1 className="text-2xl font-bold text-white"><T value={"Anmelden"} /></h1>
          <p className="mt-1 text-sm text-gray-400"><T value={"Mitglieder-Login Schwalmtalzupfer"} /></p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm text-gray-400"><T value={"Benutzername oder E-Mail"} /></label>
            <L as="input"
              type="text"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
              placeholder="benutzername oder email"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400"><T value={"Passwort"} /></label>
            <L as="input"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-400"><T value={error} /></p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-green-600 py-2.5 font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition"
          >
            <T value={loading ? 'Anmelden…' : 'Anmelden'} />
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-500"><T value={" Noch kein Konto?"} />{' '}
          <Link href="/register" className="text-green-400 hover:underline"><T value={"Einladung annehmen"} /></Link>
        </p>
      </div>
    </div>
  )
}

