import { useEffect, useRef } from 'react';
import { downloadNote } from '../lib/notenCache';

// Die PDF-Anzeige übernimmt der gemeinsame Noten-Viewer (/noten-viewer, auch auf der Website genutzt):
// Zoomstufen, Bearbeiten für Vorstand/Admin, Versionen. Die Bytes kommen aus dem lokalen Offline-Cache
// per postMessage, damit Noten auch ohne Netz angezeigt werden (Bearbeiten braucht dann Netz).
export default function PdfView({
  uri,
  noteKey,
  onError,
  onClose,
}: {
  uri: string;
  noteKey?: string;
  onError: () => void;
  onClose?: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const bytes = useRef<ArrayBuffer | null>(null);

  useEffect(() => {
    let cancelled = false;
    bytes.current = null;

    async function send() {
      if (!bytes.current) bytes.current = await (await fetch(uri)).arrayBuffer();
      if (cancelled) return;
      // Kopie, damit der Puffer für spätere "ready"-Nachrichten erhalten bleibt
      frame.current?.contentWindow?.postMessage(
        { source: 'noten-host', type: 'bytes', bytes: bytes.current.slice(0) },
        window.location.origin
      );
    }

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.source !== 'noten-viewer') return;
      if (e.data.type === 'ready') send().catch(() => { if (!cancelled) onError(); });
      else if (e.data.type === 'close') onClose?.();
      else if (e.data.type === 'saved' && noteKey) {
        // Offline-Cache auf die neue Fassung bringen
        downloadNote(noteKey).catch(() => {});
      }
    };
    window.addEventListener('message', onMessage);
    return () => { cancelled = true; window.removeEventListener('message', onMessage); };
  }, [uri, noteKey, onError, onClose]);

  return (
    <iframe
      ref={frame}
      title="Note"
      src={`/noten-viewer?host=1&key=${encodeURIComponent(noteKey ?? 'note.pdf')}`}
      style={{ flex: 1, width: '100%', height: '100%', border: 'none', background: '#1c1f1e' }}
    />
  );
}
