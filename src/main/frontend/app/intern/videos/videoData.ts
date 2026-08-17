// ═══════════════════════════════════════════════════════════════════════════════
// VIDEO-DATEN der Schwalmtalzupfer
// ─────────────────────────────────────────────────────────────────────────────
// Diese Datei bearbeiten, um Videos/Playlisten hinzuzufügen oder zu ändern.
//
//   type: 'video'    → einzelnes YouTube-Video    (id = YouTube Video-ID)
//   type: 'playlist' → YouTube-Playlist           (id = Playlist-ID)
//
// YouTube-Video-ID:    https://www.youtube.com/watch?v=XXXXXXXXXXX  →  id = 'XXXXXXXXXXX'
// YouTube-Playlist-ID: https://www.youtube.com/playlist?list=PLYYY →  id = 'PLYYY'
// ═══════════════════════════════════════════════════════════════════════════════

export interface VideoItem {
  type: 'video' | 'playlist'
  id: string
  title: string
}

export interface DayVideos {
  label: string
  videos: VideoItem[]
}

export interface KonzertYear {
  year: string
  days: DayVideos[]
}

export interface KonzertData {
  slug: string
  label: string
  emoji: string
  years: KonzertYear[]
}

export interface WeitereItem {
  label: string
  tags?: string[]   // z.B. ['2023', 'Waldniel']
  videos: VideoItem[]
}

// ─── Sommerkonzerte ───────────────────────────────────────────────────────────
// Für jedes Jahr die Tage (Freitag, Samstag, Sonntag) mit Videos befüllen.
// Neue Jahre oben einfügen (neuestes zuerst).

export const SOMMERKONZERTE: KonzertData = {
  slug: 'sommer',
  label: 'Sommerkonzert',
  emoji: '☀️',
  years: [
    {
      year: '2025',
      days: [
        { label: 'Freitag',  videos: [] },
        { label: 'Samstag',  videos: [] },
        { label: 'Sonntag',  videos: [] },
      ],
    },
    {
      year: '2024',
      days: [
        { label: 'Freitag',  videos: [] },
        { label: 'Samstag',  videos: [] },
        { label: 'Sonntag',  videos: [] },
      ],
    },
    {
      year: '2023',
      days: [
        { label: 'Freitag',  videos: [] },
        { label: 'Samstag',  videos: [] },
        { label: 'Sonntag',  videos: [] },
      ],
    },
  ],
}

// ─── Winterkonzerte ───────────────────────────────────────────────────────────

export const WINTERKONZERTE: KonzertData = {
  slug: 'winter',
  label: 'Winterkonzert',
  emoji: '❄️',
  years: [
    {
      year: '2024',
      days: [
        { label: 'Freitag',  videos: [] },
        { label: 'Samstag',  videos: [] },
        { label: 'Sonntag',  videos: [] },
      ],
    },
    {
      year: '2023',
      days: [
        { label: 'Freitag',  videos: [] },
        { label: 'Samstag',  videos: [] },
        { label: 'Sonntag',  videos: [] },
      ],
    },
  ],
}

// ─── Weitere Auftritte ────────────────────────────────────────────────────────
// Neue Einträge unten anhängen (oder beliebig neu anordnen).

export const WEITERE_AUFTRITTE: WeitereItem[] = [
  {
    label: 'Weihnachts Klüngel',
    tags: ['2023', 'Waldniel'],
    videos: [
      // Beispiel:
      // { type: 'video', id: 'XXXXXXXXXXX', title: 'Weihnachts Klüngel 2023 – Waldniel' },
    ],
  },
  {
    label: 'Generalproben Winterkonzerte',
    tags: [],
    videos: [
      // Beispiel Playlist:
      // { type: 'playlist', id: 'PLXXXXXXXXXXXXXXXXXXXXXXXX', title: 'Generalproben Playlist' },
    ],
  },
  {
    label: 'Vollständige Konzerte',
    tags: [],
    videos: [
      // { type: 'playlist', id: 'PLXXXXXXXXXXXXXXXXXXXXXXXX', title: 'Vollständige Konzerte' },
    ],
  },
]

