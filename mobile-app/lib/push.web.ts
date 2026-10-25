import { API_BASE } from './config';

// Web Push (VAPID) statt Expo-Push. Die Subscription wird als JSON mit dem Präfix "webpush:" im
// bestehenden pushToken-Feld gespeichert; der Server erkennt daran den Versandweg.
const SW_URL = '/app/sw.js';
const SW_SCOPE = '/app/';
const TOKEN_PREFIX = 'webpush:';

export type WebPushState = 'unsupported' | 'needs-install' | 'denied' | 'default' | 'granted';

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function webPushState(): WebPushState {
  // iOS erlaubt Web Push nur für auf den Home-Bildschirm gelegte Web-Apps (ab iOS 16.4).
  if (isIos() && !isStandalone()) return 'needs-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return Notification.permission as WebPushState;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function subscribe(): Promise<string | null> {
  const res = await fetch(`${API_BASE}/api/push/vapid-public-key`);
  if (!res.ok) return null;
  const { key } = await res.json();
  if (!key) return null;
  const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  await navigator.serviceWorker.ready;
  const sub =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    }));
  return TOKEN_PREFIX + JSON.stringify(sub.toJSON());
}

/** Fragt die Berechtigung an. Muss aus einem Tipp/Klick heraus aufgerufen werden (iOS-Pflicht). */
export async function enableWebPush(): Promise<string | null> {
  try {
    const state = webPushState();
    if (state === 'unsupported' || state === 'needs-install' || state === 'denied') return null;
    if (state === 'default' && (await Notification.requestPermission()) !== 'granted') return null;
    return await subscribe();
  } catch {
    return null;
  }
}

/** Automatische Registrierung ohne Dialog: nur, wenn die Berechtigung schon erteilt wurde. */
export async function registerForPushNotifications(): Promise<string | null> {
  if (webPushState() !== 'granted') return null;
  try {
    return await subscribe();
  } catch {
    return null;
  }
}
