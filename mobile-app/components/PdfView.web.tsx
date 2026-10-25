import { useEffect, useRef } from 'react';

// pdf.js liegt als statische Datei unter public/pdfjs und wird zur Laufzeit geladen, damit der Bundler
// die ESM-Datei nicht verarbeiten muss. Eingebettete PDF-Viewer von iOS-Safari zeigen nur die erste
// Seite, deshalb werden die Seiten hier selbst auf Canvas gerendert.
const PDFJS_BASE = `${window.location.origin}/app/pdfjs`;
let pdfjsPromise: Promise<any> | null = null;
function loadPdfJs(): Promise<any> {
  if (!pdfjsPromise) {
    // Dynamischer import() über new Function wäre durch die CSP (kein unsafe-eval) blockiert; ein
    // Inline-Modul-Script ist erlaubt und legt die Bibliothek auf window ab.
    pdfjsPromise = new Promise((resolve, reject) => {
      const w = window as any;
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent =
        `import * as lib from '${PDFJS_BASE}/pdf.min.mjs';` +
        `lib.GlobalWorkerOptions.workerSrc='${PDFJS_BASE}/pdf.worker.min.mjs';` +
        `window.__pdfjs=lib;window.dispatchEvent(new Event('pdfjs-ready'));`;
      script.onerror = () => reject(new Error('pdf.js konnte nicht geladen werden'));
      window.addEventListener('pdfjs-ready', () => resolve(w.__pdfjs), { once: true });
      setTimeout(() => reject(new Error('pdf.js Zeitüberschreitung')), 15000);
      document.head.appendChild(script);
    });
    pdfjsPromise.catch(() => { pdfjsPromise = null; });
  }
  return pdfjsPromise;
}

export default function PdfView({ uri, onError }: { uri: string; onError: () => void }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const container = host.current;
    if (!container) return;
    container.innerHTML = '';
    (async () => {
      const lib = await loadPdfJs();
      const doc = await lib.getDocument({ data: new Uint8Array(await (await fetch(uri)).arrayBuffer()), isEvalSupported: false }).promise;
      const width = container.clientWidth || window.innerWidth;
      const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
      for (let n = 1; n <= doc.numPages && !cancelled; n++) {
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (width / base.width) * ratio });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.cssText = 'width:100%;display:block;margin:0 0 8px;background:#fff';
        container.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      }
    })().catch(() => { if (!cancelled) onError(); });
    return () => { cancelled = true; };
  }, [uri, onError]);

  return <div ref={host} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties} />;
}
