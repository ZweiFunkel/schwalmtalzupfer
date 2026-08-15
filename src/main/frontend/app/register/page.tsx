'use client'
import { getApiBase } from '@/lib/api'

import React, { useState, Suspense, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { loadStripe, Stripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const API_BASE = getApiBase()

interface InvitationDetails {
  email: string
  expiresAt: string
  gitarrengruppe?: { wochentag: string; vonUhrzeit: string; bisUhrzeit: string; location?: string }
  amountCents?: number
}

const inputClass = 'w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none'
const labelClass = 'mb-1 block text-sm text-gray-400'

function formatEuro(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

/** Läuft innerhalb von <Elements>, da useStripe/useElements einen Provider brauchen. */
function PaymentStep({
  onConfirmed, submitting, error,
}: {
  onConfirmed: (paymentMethodId: string) => void
  submitting: boolean
  error: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [localError, setLocalError] = useState('')

  const handleConfirm = async () => {
    if (!stripe || !elements) return
    setLocalError('')
    const { error: submitError } = await elements.submit()
    if (submitError) { setLocalError(submitError.message ?? 'Eingabe unvollständig'); return }

    const { error: confirmError, setupIntent } = await stripe.confirmSetup({ elements, redirect: 'if_required' })
    if (confirmError) { setLocalError(confirmError.message ?? 'Zahlungsart konnte nicht bestätigt werden'); return }
    if (!setupIntent || typeof setupIntent.payment_method !== 'string') { setLocalError('Zahlungsart konnte nicht bestätigt werden'); return }

    onConfirmed(setupIntent.payment_method)
  }

  return (
    <div className="flex flex-col gap-4">
      <PaymentElement />
      {(localError || error) && (
        <p className="rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-400">{localError || error}</p>
      )}
      <button type="button" onClick={handleConfirm} disabled={submitting || !stripe}
        className="mt-2 rounded-lg bg-green-600 py-2.5 font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">
        {submitting ? 'Wird registriert…' : 'Jetzt registrieren'}
      </button>
    </div>
  )
}

function RegisterForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''

  const [details, setDetails] = useState<InvitationDetails | null>(null)
  const [detailsError, setDetailsError] = useState('')
  const [loadingDetails, setLoadingDetails] = useState(true)

  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [iban, setIban] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const [step, setStep] = useState<'form' | 'payment'>('form')
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)
  const [clientSecret, setClientSecret] = useState('')
  const [customerId, setCustomerId] = useState('')

  useEffect(() => {
    document.title = 'Registrierung – Schwalmtalzupfer'
    fetch(`${API_BASE}/api/invitation/details?token=${encodeURIComponent(token)}`)
      .then(async res => {
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? 'Einladung nicht gefunden') }
        return res.json()
      })
      .then(setDetails)
      .catch(err => setDetailsError(err.message))
      .finally(() => setLoadingDetails(false))
  }, [token])

  const finishRegistration = useCallback(async (stripePaymentMethodId?: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/invitation/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token, password, vorname, nachname,
          username: username || undefined,
          iban: iban || undefined,
          stripeCustomerId: stripePaymentMethodId ? customerId : undefined,
          stripePaymentMethodId: stripePaymentMethodId || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Registrierung fehlgeschlagen' }))
        throw new Error(data.error || 'Registrierung fehlgeschlagen')
      }
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token, password, vorname, nachname, username, iban, customerId, router])

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!details?.amountCents) {
      await finishRegistration()
      return
    }

    setLoading(true)
    setError('')
    try {
      const [configRes, intentRes] = await Promise.all([
        fetch(`${API_BASE}/api/payment/config`),
        fetch(`${API_BASE}/api/payment/registration-intent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
        }),
      ])
      if (!configRes.ok || !intentRes.ok) throw new Error('Zahlungssetup konnte nicht gestartet werden')
      const config = await configRes.json()
      const intent = await intentRes.json()
      setStripePromise(loadStripe(config.publishableKey))
      setClientSecret(intent.clientSecret)
      setCustomerId(intent.customerId)
      setStep('payment')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center text-green-400">
        <p className="text-lg font-semibold">✓ Registrierung erfolgreich!</p>
        <p className="text-sm text-gray-400 mt-1">Du wirst zur Login-Seite weitergeleitet…</p>
      </div>
    )
  }

  if (loadingDetails) return <p className="text-gray-400 text-sm text-center">Laden…</p>
  if (detailsError) return <p className="rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-400">{detailsError}</p>

  return (
    <div className="flex flex-col gap-4">
      {details?.gitarrengruppe && (
        <div className="rounded-lg border border-green-500/30 bg-green-900/10 px-4 py-3 text-sm text-gray-300">
          <p className="font-semibold text-white mb-1">Deine Unterrichtsgruppe</p>
          <p>{details.gitarrengruppe.wochentag}, {details.gitarrengruppe.vonUhrzeit}–{details.gitarrengruppe.bisUhrzeit} Uhr</p>
          {details.gitarrengruppe.location && <p>{details.gitarrengruppe.location}</p>}
          {details.amountCents !== undefined && <p className="mt-1 font-semibold text-green-400">{formatEuro(details.amountCents)} / Monat</p>}
        </div>
      )}

      {step === 'form' && (
        <form onSubmit={handleContinue} className="flex flex-col gap-4">
          <div>
            <label className={labelClass}>Einladungs-Token</label>
            <input value={token} readOnly className="w-full rounded-lg border border-white/10 bg-slate-700 px-3 py-2 text-gray-400 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Vorname</label>
              <input value={vorname} onChange={e => setVorname(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Nachname</label>
              <input value={nachname} onChange={e => setNachname(e.target.value)} required className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Username (optional)</label>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="z.B. max.mustermann" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Passwort wählen</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
          </div>
          {!details?.amountCents && (
            <div>
              <label className={labelClass}>IBAN (optional, für Beitragsabbuchung)</label>
              <input type="text" value={iban} onChange={e => setIban(e.target.value)} placeholder="DE00 0000 0000 0000 0000 00" className={inputClass} />
            </div>
          )}
          {error && <p className="rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={loading}
            className="mt-2 rounded-lg bg-green-600 py-2.5 font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">
            {loading ? 'Wird geladen…' : details?.amountCents ? 'Weiter zur Zahlungsart' : 'Konto erstellen'}
          </button>
        </form>
      )}

      {step === 'payment' && stripePromise && clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentStep onConfirmed={pmId => finishRegistration(pmId)} submitting={loading} error={error} />
        </Elements>
      )}
    </div>
  )
}

export default function RegisterPage() {
  useEffect(() => { document.title = 'Registrierung – Schwalmtalzupfer' }, [])
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">𝄞</div>
          <h1 className="text-2xl font-bold text-white">Einladung annehmen</h1>
          <p className="mt-1 text-sm text-gray-400">Erstelle dein Mitgliedskonto</p>
        </div>
        <Suspense fallback={<p className="text-gray-400 text-sm text-center">Laden…</p>}>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  )
}
