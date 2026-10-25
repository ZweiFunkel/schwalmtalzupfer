// www. direkt nutzen - schwalmtalzupfer.de (ohne www) leitet per 301 auf www um,
// und ein 301 wandelt POST-Requests bei vielen HTTP-Clients (auch React Native fetch) in GET um.
// Die Web-App läuft auf derselben Domain wie das Backend und nutzt deshalb den eigenen Ursprung
// (kein CORS, kein www/apex-Mismatch).
const WEB_ORIGIN = typeof document !== 'undefined' ? window.location.origin : null;
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? WEB_ORIGIN ?? 'https://www.schwalmtalzupfer.de';
