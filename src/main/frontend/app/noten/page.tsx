'use client'
import { getApiBase } from '@/lib/api'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth, isBoard } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeProvider'

const API_BASE = getApiBase()

interface Note { key: string; name: string; size: number; lastModified: string }

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return '📄'
  if (['mxl', 'xml', 'musicxml'].includes(ext ?? '')) return '🎼'
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext ?? '')) return '🎵'
  if (['jpg', 'jpeg', 'png'].includes(ext ?? '')) return '🖼'
  if (['zip', 'rar'].includes(ext ?? '')) return '📦'
  return '📎'
}

function isPreviewable(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return ['pdf', 'mp3', 'wav', 'ogg', 'flac', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
}

function isAudio(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return ['mp3', 'wav', 'ogg', 'flac'].includes(ext)
}

function isImage(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
}

// ─── Upload-Bereich (nur BOARD / ADMIN) ────────────────────────────────────────
interface UploadStatus {
  phase: 'idle' | 'ready' | 'uploading' | 'done'
  files: File[]
  toUpload: File[]      // wirklich neu
  duplicates: string[]  // bereits vorhanden (client-seitig erkannt)
  processed: number
  added: number
  skipped: number
  errors: number
  currentFile: string
  addedFiles: string[]
  skippedFiles: string[]
  errorFiles: string[]
}

const initialUploadStatus = (): UploadStatus => ({
  phase: 'idle', files: [], toUpload: [], duplicates: [],
  processed: 0, added: 0, skipped: 0, errors: 0,
  currentFile: '', addedFiles: [], skippedFiles: [], errorFiles: [],
})

function UploadSection({
  prefix, existingNames, onDone, dk,
}: {
  prefix: string
  existingNames: Set<string>
  onDone: () => void
  dk: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<UploadStatus>(initialUploadStatus())

  const panelCl  = dk ? 'border-white/10 bg-slate-800/60' : 'border-gray-200 bg-gray-50'
  const headCl   = dk ? 'text-white' : 'text-gray-900'
  const subCl    = dk ? 'text-gray-400' : 'text-gray-500'
  const tableBg  = dk ? 'bg-slate-900/60' : 'bg-white'
  const badgeNew = 'bg-green-500/20 text-green-400 border border-green-500/30'
  const badgeDup = 'bg-amber-500/20 text-amber-400 border border-amber-500/30'

  const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    if (picked.length === 0) return

    const toUpload: File[] = []
    const duplicates: string[] = []
    for (const f of picked) {
      if (existingNames.has(f.name)) duplicates.push(f.name)
      else toUpload.push(f)
    }
    setStatus({ ...initialUploadStatus(), phase: 'ready', files: picked, toUpload, duplicates })
    // Reset input so derselbe Auswahl nochmal gewählt werden kann
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const startUpload = async () => {
    const { toUpload, duplicates } = status
    const total = status.files.length
    let added = 0, errors = 0
    const addedFiles: string[] = []
    const errorFiles: string[] = []

    setStatus(s => ({ ...s, phase: 'uploading', processed: 0, skipped: duplicates.length, skippedFiles: duplicates }))

    for (let i = 0; i < toUpload.length; i++) {
      const file = toUpload[i]
      setStatus(s => ({ ...s, currentFile: file.name, processed: duplicates.length + i }))

      try {
        const form = new FormData()
        form.append('files', file)
        form.append('prefix', prefix)
        const res = await fetch(`${API_BASE}/api/noten/upload`, {
          method: 'POST',
          credentials: 'include',
          body: form,
        })
        if (res.ok) {
          const data = await res.json()
          // Backend gibt addedFiles / skippedFiles zurück
          if ((data.addedFiles as string[]).length > 0) {
            added++
            addedFiles.push(file.name)
          } else {
            // wurde serverseitig als Duplikat gewertet
            setStatus(s => ({
              ...s,
              skipped: s.skipped + 1,
              skippedFiles: [...s.skippedFiles, file.name],
            }))
          }
        } else {
          errors++
          errorFiles.push(file.name)
        }
      } catch {
        errors++
        errorFiles.push(file.name)
      }

      setStatus(s => ({
        ...s,
        processed: duplicates.length + i + 1,
        added,
        errors,
        addedFiles,
        errorFiles,
      }))
    }

    setStatus(s => ({
      ...s,
      phase: 'done',
      processed: total,
      currentFile: '',
      added,
      errors,
      addedFiles,
      errorFiles,
    }))
    if (added > 0) onDone() // Dateiliste neu laden
  }

  const reset = () => setStatus(initialUploadStatus())

  // ── Phase: idle ──────────────────────────────────────────────────────────────
  if (status.phase === 'idle') {
    return (
      <div className={`mb-6 rounded-xl border p-4 ${panelCl}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className={`text-sm font-semibold ${headCl}`}>📤 Noten hochladen</p>
            <p className={`text-xs mt-0.5 ${subCl}`}>Mehrere Dateien gleichzeitig möglich · Duplikate werden automatisch übersprungen</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition shadow shadow-green-500/20">
            📂 Dateien auswählen
          </button>
        </div>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onFilesSelected} />
      </div>
    )
  }

  // ── Phase: ready (Vorschau vor Upload) ───────────────────────────────────────
  if (status.phase === 'ready') {
    const total = status.files.length
    return (
      <div className={`mb-6 rounded-xl border p-4 ${panelCl}`}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className={`text-sm font-semibold ${headCl}`}>📤 {total} Datei{total !== 1 ? 'en' : ''} ausgewählt</p>
          <div className="flex gap-2">
            <button onClick={reset} className={`rounded-lg border px-3 py-1.5 text-xs transition ${dk ? 'border-white/10 text-gray-400 hover:text-white' : 'border-gray-300 text-gray-500 hover:text-gray-800'}`}>
              Abbrechen
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${dk ? 'border-white/10 text-gray-400 hover:text-white' : 'border-gray-300 text-gray-500 hover:text-gray-800'}`}>
              Neu wählen
            </button>
            {status.toUpload.length > 0 && (
              <button onClick={startUpload}
                className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-500 transition">
                ⬆ {status.toUpload.length} Datei{status.toUpload.length !== 1 ? 'en' : ''} hochladen
              </button>
            )}
          </div>
        </div>

        {/* Übersicht-Badges */}
        <div className="flex gap-3 mb-3 flex-wrap">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeNew}`}>
            ✅ {status.toUpload.length} neu
          </span>
          {status.duplicates.length > 0 && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeDup}`}>
              ⚠️ {status.duplicates.length} bereits vorhanden
            </span>
          )}
        </div>

        {/* Dateiliste */}
        <div className={`rounded-lg border ${dk ? 'border-white/10' : 'border-gray-200'} divide-y ${dk ? 'divide-white/5' : 'divide-gray-100'} max-h-52 overflow-y-auto ${tableBg}`}>
          {status.files.map((f, i) => {
            const isDup = status.duplicates.includes(f.name)
            return (
              <div key={i} className="flex items-center justify-between px-3 py-2 text-xs gap-2">
                <span className={`truncate ${isDup ? 'text-gray-500' : (dk ? 'text-white' : 'text-gray-800')}`}>
                  {fileIcon(f.name)} {f.name}
                </span>
                {isDup
                  ? <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${badgeDup}`}>vorhanden</span>
                  : <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${badgeNew}`}>neu</span>
                }
              </div>
            )
          })}
        </div>
        {status.toUpload.length === 0 && (
          <p className={`mt-3 text-xs text-center ${subCl}`}>
            Alle ausgewählten Dateien sind bereits vorhanden. Nichts zum Hochladen.
          </p>
        )}
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onFilesSelected} />
      </div>
    )
  }

  // ── Phase: uploading ─────────────────────────────────────────────────────────
  if (status.phase === 'uploading') {
    const total = status.files.length
    const pct = total > 0 ? Math.round((status.processed / total) * 100) : 0
    return (
      <div className={`mb-6 rounded-xl border p-4 ${panelCl}`}>
        <p className={`text-sm font-semibold mb-3 ${headCl}`}>⬆ Upload läuft…</p>

        {/* Fortschrittsbalken */}
        <div className={`h-2 rounded-full overflow-hidden mb-3 ${dk ? 'bg-slate-700' : 'bg-gray-200'}`}>
          <div className="h-full bg-green-500 transition-all duration-300 rounded-full" style={{ width: `${pct}%` }} />
        </div>

        {/* Live-Zähler */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <StatBox label="Gesamt" value={total} dk={dk} />
          <StatBox label="Verarbeitet" value={status.processed} dk={dk} color="text-blue-400" />
          <StatBox label="Noch offen" value={total - status.processed} dk={dk} color="text-amber-400" />
          <StatBox label="Hinzugefügt" value={status.added} dk={dk} color="text-green-400" />
        </div>

        {status.currentFile && (
          <p className={`text-xs truncate ${subCl}`}>
            <span className="animate-pulse">●</span> {status.currentFile}
          </p>
        )}
      </div>
    )
  }

  // ── Phase: done ──────────────────────────────────────────────────────────────
  const total = status.files.length
  return (
    <div className={`mb-6 rounded-xl border p-4 ${panelCl}`}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className={`text-sm font-semibold ${headCl}`}>
          {status.errors > 0 ? '⚠️' : '✅'} Upload abgeschlossen
        </p>
        <button onClick={reset} className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-500 transition">
          Weiteren Upload starten
        </button>
      </div>

      {/* Abschluss-Statistik */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="Gesamt" value={total} dk={dk} />
        <StatBox label="Hinzugefügt" value={status.added} dk={dk} color="text-green-400" />
        <StatBox label="Bereits vorhanden" value={status.skipped} dk={dk} color="text-amber-400" />
        <StatBox label="Fehler" value={status.errors} dk={dk} color={status.errors > 0 ? 'text-red-400' : undefined} />
      </div>

      {/* Detail-Listen */}
      {status.addedFiles.length > 0 && (
        <details className="mt-4">
          <summary className={`cursor-pointer text-xs font-semibold text-green-400 select-none`}>
            ✅ Hinzugefügte Dateien ({status.addedFiles.length})
          </summary>
          <ul className={`mt-2 text-xs space-y-1 ${subCl}`}>
            {status.addedFiles.map((f, i) => <li key={i} className="truncate">· {f}</li>)}
          </ul>
        </details>
      )}
      {status.skippedFiles.length > 0 && (
        <details className="mt-3">
          <summary className={`cursor-pointer text-xs font-semibold text-amber-400 select-none`}>
            ⚠️ Bereits vorhanden ({status.skippedFiles.length})
          </summary>
          <ul className={`mt-2 text-xs space-y-1 ${subCl}`}>
            {status.skippedFiles.map((f, i) => <li key={i} className="truncate">· {f}</li>)}
          </ul>
        </details>
      )}
      {status.errorFiles.length > 0 && (
        <details className="mt-3">
          <summary className={`cursor-pointer text-xs font-semibold text-red-400 select-none`}>
            ❌ Fehler ({status.errorFiles.length})
          </summary>
          <ul className={`mt-2 text-xs space-y-1 ${subCl}`}>
            {status.errorFiles.map((f, i) => <li key={i} className="truncate">· {f}</li>)}
          </ul>
        </details>
      )}
    </div>
  )
}

function StatBox({ label, value, dk, color }: { label: string; value: number; dk: boolean; color?: string }) {
  return (
    <div className={`rounded-lg p-3 text-center ${dk ? 'bg-slate-700/50' : 'bg-white border border-gray-200'}`}>
      <div className={`text-xl font-bold ${color ?? (dk ? 'text-white' : 'text-gray-900')}`}>{value}</div>
      <div className={`text-xs mt-0.5 ${dk ? 'text-gray-400' : 'text-gray-500'}`}>{label}</div>
    </div>
  )
}


function PreviewModal({ note, onClose }: { note: Note; onClose: () => void }) {
  const apiUrl = `${API_BASE}/api/noten/preview?key=${encodeURIComponent(note.key)}`
  const downloadUrl = `${API_BASE}/api/noten/download?key=${encodeURIComponent(note.key)}`
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  // iOS Safari unterstützt keine PDF-iframes → alternativen View anzeigen
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
  }, [])

  // Datei mit Auth-Credentials laden und als Blob-URL bereitstellen
  useEffect(() => {
    let objectUrl: string | null = null
    fetch(apiUrl, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status)
        return r.blob()
      })
      .then(blob => {
        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
      })
      .catch(() => setLoadError(true))
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [apiUrl])

  // ESC zum Schließen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-2xl bg-slate-900 border border-white/10 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl">{fileIcon(note.name)}</span>
            <span className="font-semibold text-white truncate text-sm">{note.name}</span>
            <span className="text-gray-500 text-xs whitespace-nowrap">{formatBytes(note.size)}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer"
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500 transition">
              ⬇ Download
            </a>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none px-1">✕</button>
          </div>
        </div>

        {/* Inhalt */}
        <div className="flex-1 overflow-auto min-h-0">
          {loadError ? (
            <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
              <span className="text-5xl">⚠️</span>
              <p className="text-gray-300 text-sm">Datei konnte nicht geladen werden.</p>
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer"
                className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition">
                ⬇ Direkt herunterladen
              </a>
            </div>
          ) : !blobUrl ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="text-4xl mb-3 animate-pulse">{fileIcon(note.name)}</div>
                <p className="text-gray-400 text-sm">Lade Vorschau…</p>
              </div>
            </div>
          ) : isAudio(note.name) ? (
            <div className="flex flex-col items-center justify-center gap-6 p-12">
              <span className="text-7xl">🎵</span>
              <p className="text-white font-semibold text-lg text-center">{note.name}</p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls autoPlay className="w-full max-w-lg" src={blobUrl}>
                Dein Browser unterstützt kein Audio.
              </audio>
            </div>
          ) : isImage(note.name) ? (
            <div className="flex items-center justify-center p-4 min-h-[400px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={blobUrl} alt={note.name} className="max-w-full max-h-[75vh] object-contain rounded-lg" />
            </div>
          ) : note.name.toLowerCase().endsWith('.pdf') ? (
            isMobile ? (
              // iOS Safari / Mobile: PDF-iframe funktioniert nicht → direkter Link
              <div className="flex flex-col items-center justify-center gap-5 p-12 text-center">
                <span className="text-6xl">📄</span>
                <p className="text-white font-semibold">{note.name}</p>
                <p className="text-gray-400 text-sm">PDF-Vorschau wird auf diesem Gerät nicht unterstützt.</p>
                <a href={blobUrl!} target="_blank" rel="noopener noreferrer"
                  className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition">
                  📄 PDF im Browser öffnen
                </a>
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer"
                  className="rounded-lg border border-white/20 px-5 py-2.5 text-sm font-semibold text-gray-300 hover:text-white transition">
                  ⬇ Herunterladen
                </a>
              </div>
            ) : (
              <iframe
                src={blobUrl!}
                title={note.name}
                className="w-full"
                style={{ height: '75vh', border: 'none' }}
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
              <span className="text-6xl">{fileIcon(note.name)}</span>
              <p className="text-gray-300 text-sm">Keine Vorschau verfügbar für diesen Dateityp.</p>
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer"
                className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition">
                ⬇ Datei herunterladen
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NotenPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { theme } = useTheme()
  const dk = theme === 'dark'
  const canUpload = isBoard(user)

  // Theme-abhängige Klassen
  const pageBg      = dk ? '' : 'bg-white'
  const headingCl   = dk ? 'text-white' : 'text-gray-900'
  const subCl       = dk ? 'text-gray-400' : 'text-gray-500'
  const inputCl     = dk
    ? 'border-white/10 bg-slate-800 text-white placeholder-gray-500 focus:border-green-500'
    : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-green-500'
  const clearBtnCl  = dk
    ? 'border-white/10 text-gray-400 hover:text-white'
    : 'border-gray-300 text-gray-500 hover:text-gray-800'
  const tableBorderCl = dk ? 'border-white/10' : 'border-gray-200'
  const theadCl     = dk ? 'bg-slate-800 text-gray-400' : 'bg-gray-100 text-gray-500'
  const rowBaseCl   = dk ? 'bg-slate-900 hover:bg-slate-800' : 'bg-white hover:bg-gray-50'
  const rowSelCl    = dk ? 'bg-green-900/20 hover:bg-green-900/30' : 'bg-green-50 hover:bg-green-100/70'
  const divideCl    = dk ? 'divide-white/5' : 'divide-gray-200'
  const filenameCl  = dk ? 'text-white' : 'text-gray-900'
  const folderCl    = dk ? 'text-gray-500' : 'text-gray-400'
  const sizeCl      = dk ? 'text-gray-400' : 'text-gray-500'
  const dlBtnCl     = dk
    ? 'bg-slate-700 hover:bg-slate-600 text-gray-200 hover:text-white'
    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900'
  const footerCl    = dk ? 'bg-slate-800/60 text-gray-500' : 'bg-gray-50 text-gray-400'
  const checkboxCl  = dk ? 'border-white/20 bg-slate-700' : 'border-gray-300 bg-white'

  const [prefix, setPrefix] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)
  const [preview, setPreview] = useState<Note | null>(null)
  const downloadLinkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => { document.title = 'Notenarchiv – Schwalmtalzupfer' }, [])

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    fetch(`${API_BASE}/api/site/settings`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, string>) => setPrefix(data.noten_prefix ?? ''))
      .catch(() => setPrefix(''))
  }, [user])

  const loadNotes = useCallback(async (p: string) => {
    setLoading(true)
    setSelected(new Set())
    try {
      const res = await fetch(`${API_BASE}/api/noten/list?prefix=${encodeURIComponent(p)}`, { credentials: 'include' })
      if (res.ok) setNotes(await res.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (prefix !== null) loadNotes(prefix)
  }, [prefix, loadNotes])

  const filtered = notes.filter(n =>
    n.name.toLowerCase().includes(search.toLowerCase()) ||
    n.key.toLowerCase().includes(search.toLowerCase())
  )

  const toggleSelect = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(n => n.key)))
  }

  const downloadSingle = (key: string) => {
    window.open(`${API_BASE}/api/noten/download?key=${encodeURIComponent(key)}`, '_blank')
  }

  const downloadSelected = async () => {
    if (selected.size === 0) return
    setDownloading(true)
    try {
      const res = await fetch(`${API_BASE}/api/noten/download/zip`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: Array.from(selected) }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = downloadLinkRef.current!
        a.href = url; a.download = 'Noten_Auswahl.zip'; a.click()
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      }
    } finally { setDownloading(false) }
  }

  const downloadAll = () => {
    window.open(`${API_BASE}/api/noten/download/all?prefix=${encodeURIComponent(prefix ?? '')}`, '_blank')
  }

  if (authLoading || prefix === null) return (
    <div className="flex min-h-[60vh] items-center justify-center text-gray-400">Laden…</div>
  )
  if (!user) return null

  const allSelected = filtered.length > 0 && selected.size === filtered.length

  return (
    <div className={`mx-auto max-w-5xl px-6 py-12 ${pageBg}`}>
      {/* Breadcrumb */}
      <div className={`mb-6 flex items-center gap-2 text-sm ${subCl}`}>
        <Link href="/intern" className="hover:text-green-500 dark:hover:text-green-400 transition">Intern</Link>
        <span>/</span>
        <span className={headingCl}>Notenarchiv</span>
      </div>

      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold ${headingCl}`}>🎼 Noten</h1>
          <p className={`mt-1 text-sm ${subCl}`}>Download-Bereich für Vereinsmitglieder</p>
        </div>
        <button onClick={downloadAll}
          className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition shadow-lg shadow-green-500/20">
          ⬇ Alle Noten als ZIP
        </button>
      </div>

      {/* Upload-Bereich (nur BOARD / ADMIN) */}
      {canUpload && (
        <UploadSection
          prefix={prefix}
          existingNames={new Set(notes.map(n => n.name))}
          onDone={() => loadNotes(prefix)}
          dk={dk}
        />
      )}

      {/* Suche */}
      <div className="mb-6 flex gap-3">
        <div className="flex-1">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Noten suchen…"
            className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none transition ${inputCl}`} />
        </div>
        {search && (
          <button onClick={() => setSearch('')} className={`rounded-xl border px-3 py-2.5 text-sm transition ${clearBtnCl}`}>✕</button>
        )}
      </div>

      {/* Auswahl-Aktionen */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-900/20 px-4 py-3">
          <span className="text-sm text-green-400 font-semibold">{selected.size} Datei(en) ausgewählt</span>
          <button onClick={downloadSelected} disabled={downloading}
            className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">
            {downloading ? 'Packe ZIP…' : '⬇ Auswahl als ZIP'}
          </button>
          <button onClick={() => setSelected(new Set())} className={`ml-auto text-xs transition ${subCl} hover:text-green-400`}>
            Auswahl aufheben
          </button>
        </div>
      )}

      {/* Dateiliste */}
      {loading ? (
        <div className={`flex items-center justify-center py-20 ${subCl}`}>
          <div className="text-center">
            <div className="text-4xl mb-3 animate-pulse">🎼</div>
            <p>Lade Noten…</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className={`flex items-center justify-center py-20 ${subCl}`}>
          <div className="text-center">
            <div className="text-4xl mb-3">🗂</div>
            <p>{search ? 'Keine Noten gefunden.' : 'Noch keine Noten vorhanden.'}</p>
          </div>
        </div>
      ) : (
        <div className={`overflow-hidden rounded-xl border ${tableBorderCl}`}>
          <table className="w-full text-sm">
            <thead className={theadCl}>
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className={`rounded accent-green-500 cursor-pointer ${checkboxCl}`} />
                </th>
                <th className="px-4 py-3 text-left">Dateiname</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Ordner</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Größe</th>
                <th className="px-4 py-3 text-left">Aktionen</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${divideCl}`}>
              {filtered.map(note => (
                <tr key={note.key}
                  className={`transition cursor-pointer ${selected.has(note.key) ? rowSelCl : rowBaseCl}`}
                  onClick={() => toggleSelect(note.key)}>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(note.key)} onChange={() => toggleSelect(note.key)}
                      className={`rounded accent-green-500 cursor-pointer ${checkboxCl}`} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{fileIcon(note.name)}</span>
                      <span className={`font-medium ${filenameCl}`}>{note.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`font-mono text-xs ${folderCl}`}>
                      {note.key.includes('/') ? note.key.substring(0, note.key.lastIndexOf('/')) : '/'}
                    </span>
                  </td>
                  <td className={`px-4 py-3 hidden md:table-cell whitespace-nowrap ${sizeCl}`}>{formatBytes(note.size)}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1.5 flex-col sm:flex-row">
                      {isPreviewable(note.name) && (
                        <button onClick={() => setPreview(note)}
                          className={`rounded-lg px-2 sm:px-3 py-1.5 text-xs transition ${dlBtnCl}`}>
                          <span className="sm:hidden">👁</span>
                          <span className="hidden sm:inline whitespace-nowrap">👁 Vorschau</span>
                        </button>
                      )}
                      <button onClick={() => downloadSingle(note.key)}
                        className={`rounded-lg px-2 sm:px-3 py-1.5 text-xs transition ${dlBtnCl}`}>
                        <span className="sm:hidden">⬇</span>
                        <span className="hidden sm:inline whitespace-nowrap">⬇ Download</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={`px-4 py-2.5 flex items-center justify-between text-xs ${footerCl}`}>
            <span>{filtered.length} Datei(en){search && ` (gefiltert von ${notes.length})`}</span>
            {selected.size > 0 && (
              <button onClick={downloadSelected} disabled={downloading}
                className="text-green-400 hover:text-green-300 transition">
                ⬇ {selected.size} ausgewählte als ZIP
              </button>
            )}
          </div>
        </div>
      )}

      {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
      <a ref={downloadLinkRef} className="hidden" />

      {/* Vorschau-Modal */}
      {preview && <PreviewModal note={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
