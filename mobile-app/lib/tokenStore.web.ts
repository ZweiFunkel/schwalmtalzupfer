// Web-Variante: SecureStore gibt es im Browser nicht, der Token liegt im localStorage dieser Origin.
const TOKEN_KEY = 'auth_token';

export async function readToken(): Promise<string | null> {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function writeToken(token: string): Promise<void> {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Speicher gesperrt - nichts zu löschen
  }
}
