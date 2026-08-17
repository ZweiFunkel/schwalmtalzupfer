// www. direkt nutzen - schwalmtalzupfer.de (ohne www) leitet per 301 auf www um,
// und ein 301 wandelt POST-Requests bei vielen HTTP-Clients (auch React Native fetch) in GET um.
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://www.schwalmtalzupfer.de';
