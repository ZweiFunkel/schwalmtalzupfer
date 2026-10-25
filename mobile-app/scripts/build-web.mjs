// Baut die Web-App (Expo Web, SPA unter /app) und ergänzt index.html um PWA-Metadaten.
// Ausgabe: mobile-app/web-dist -> wird von Maven nach static/app kopiert (siehe pom.xml).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'web-dist');

rmSync(out, { recursive: true, force: true });
execSync(`npx expo export --platform web --output-dir web-dist`, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, EXPO_WEB_BUILD: '1', CI: '1' },
});

// Expo legt alle Schriften ab, die irgendein Paket mitbringt. Eingecheckt wird nur, was die App wirklich lädt
// (Inter in vier Schnitten, Ionicons) - der Rest wären rund 10 MB Ballast pro Build.
const KEEP_FONTS = /^(Inter_(400Regular|500Medium|600SemiBold|700Bold)|Ionicons)\./;
const assets = join(out, 'assets');
let removed = 0;
for (const entry of readdirSync(assets, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.ttf')) continue;
  if (KEEP_FONTS.test(entry.name)) continue;
  rmSync(join(entry.parentPath, entry.name));
  removed++;
}
console.log(`${removed} ungenutzte Schriftdateien entfernt.`);

const head = `
<meta name="theme-color" content="#16a34a">
<link rel="manifest" href="/app/manifest.webmanifest">
<link rel="apple-touch-icon" href="/app/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Zupfer">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="description" content="Noten, Termine und Vereinsinfos der Schwalmtalzupfer">
<meta name="robots" content="noindex">`;
const sw = `<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/app/sw.js',{scope:'/app/'}).catch(function(){})})}</script>`;

const file = join(out, 'index.html');
let html = readFileSync(file, 'utf8');
html = html.replace(/<meta name="viewport"[^>]*>/i, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
html = html.replace('</head>', `${head}\n</head>`).replace('</body>', `${sw}\n</body>`);
writeFileSync(file, html);
console.log('PWA-Metadaten in index.html ergänzt.');
