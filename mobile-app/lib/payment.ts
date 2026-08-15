import { apiFetch } from './api';

export interface PaymentStatus {
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'SETUP_AUSSTEHEND' | 'KEIN_VERTRAG';
  startDate?: string;
  amountCents?: number;
}

export async function fetchPaymentStatus(): Promise<PaymentStatus> {
  const res = await apiFetch('/api/payment/method');
  if (!res.ok) throw new Error('Zahlungsstatus konnte nicht geladen werden');
  return res.json();
}

/** Holt eine fehlgeschlagene Zahlungseinrichtung nach - erst nachdem im Kundenportal eine Zahlungsart hinterlegt wurde. */
export async function retrySubscription(): Promise<PaymentStatus> {
  const res = await apiFetch('/api/payment/retry-subscription', { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'Zahlungseinrichtung konnte nicht abgeschlossen werden');
  }
  return res.json();
}

export async function createBillingPortalSession(returnUrl: string): Promise<string> {
  const res = await apiFetch('/api/payment/portal-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnUrl }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'Zahlungsportal konnte nicht geöffnet werden');
  }
  const data = await res.json();
  return data.url;
}
