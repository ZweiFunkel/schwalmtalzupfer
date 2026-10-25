import { useEffect, useRef } from 'react';

// pdf.js liegt als statische Datei unter public/pdfjs und wird zur Laufzeit geladen, damit der Bundler
// die ESM-Datei nicht verarbeiten muss. Eingebettete PDF-Viewer von iOS-Safari zeigen nur die erste
// Seite, deshalb werden die Seiten hier selbst auf Canvas gerendert.
const PDFJS_BASE = `${window.location.origin}/app/pdfjs`;
let pdfjsPromise: Promise<any> | null = null;
function loadPdfJs(): Promise<any> {
  if (!pdfjsPromise) {
    const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<any>;
    pdfjsPromise = dynamicImport(`${PDFJS_BASE}/pdf.min.mjs`).then(lib => {
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.mjs`;
      return lib;
    });
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
      const doc = await lib.getDocument({ data: new Uint8Array(await (await fetch(uri)).arrayBuffer()) }).promise;
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
