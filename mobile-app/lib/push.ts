import * as Notifications from 'expo-notifications';

/**
 * Bestmögliche Push-Registrierung: fragt Berechtigung an (falls noch unbekannt) und holt den
 * Expo-Push-Token. Schlägt bei fehlender Berechtigung oder fehlendem EAS-Projekt lautlos fehl -
 * blockiert nie den Rest der App.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    return null;
  }
}

// Die folgenden Teile betreffen nur den Browser (siehe push.web.ts); native Apps fragen die
// Berechtigung direkt in registerForPushNotifications() an.
export type WebPushState = 'unsupported' | 'needs-install' | 'denied' | 'default' | 'granted';

export function webPushState(): WebPushState {
  return 'granted';
}

export async function enableWebPush(): Promise<string | null> {
  return registerForPushNotifications();
}
