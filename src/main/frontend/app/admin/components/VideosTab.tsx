'use client'
import { getApiBase } from '@/lib/api'
import React, { useEffect, useState } from 'react'
import { ImageField } from './ImageField'

const API_BASE = getApiBase()

interface VideoEntry {
  id?: string
  category: string
  year: string
  day: string
  subcategory: string
  tags: string
  type: string
  youtubeId: string
  title: string
  thumbnailUrl: string
  position: number
}

const EMPTY_VIDEO: VideoEntry = {
  category: 'SOMMER', year: '', day: '',
  subcategory: '', tags: '', type: 'VIDEO',
  youtubeId: '', title: '', thumbnailUrl: '', position: 0,
}

/** Extrahiert Video-ID oder Playlist-ID aus einem YouTube-URL oder gibt den Wert unverändert zurück.
 *  Gibt auch den erkannten Typ zurück: 'VIDEO' | 'PLAYLIST' | null (wenn nicht erkannt) */
function extractYouTubeId(input: string): { id: string; type: 'VIDEO' | 'PLAYLIST' | null } {
  const s = input.trim()
  // Playlist-URL: ?list=... oder &list=...
  const playlistMatch = s.match(/[?&]list=([a-zA-Z0-9_-]{10,})/i)
  if (playlistMatch) return { id: playlistMatch[1], type: 'PLAYLIST' }
  // youtu.be/VIDEO_ID
  const shortMatch = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i)
  if (shortMatch) return { id: shortMatch[1], type: 'VIDEO' }
  // youtube.com/watch?v=VIDEO_ID
  const watchMatch = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/i)
  if (watchMatch) return { id: watchMatch[1], type: 'VIDEO' }
  // youtube.com/shorts/VIDEO_ID
  const shortsMatch = s.match(/\/shorts\/([a-zA-Z0-9_-]{11})/i)
  if (shortsMatch) return { id: shortsMatch[1], type: 'VIDEO' }
  // Kein URL erkannt → Eingabe direkt als ID weitergeben
  return { id: s, type: null }
}

export default function VideosTab() {
  const [videos, setVideos] = useState<VideoEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<VideoEntry>(EMPTY_VIDEO)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = () => {
    setLoading(true)
    fetch(`${API_BASE}/api/intern/videos`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setVideos)
      .catch(() => setVideos([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const set = (k: keyof VideoEntry, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.youtubeId.trim() || !form.title.trim()) { setMsg('YouTube-ID und Titel sind Pflichtfelder.'); return }
    setSaving(true); setMsg('')
    const method = editId ? 'PUT' : 'POST'
    const url = editId ? `${API_BASE}/api/intern/videos/${editId}` : `${API_BASE}/api/intern/videos`
    const res = await fetch(url, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) { setForm(EMPTY_VIDEO); setEditId(null); load(); setMsg(editId ? '✓ Video aktualisiert.' : '✓ Video hinzugefügt.') }
    else setMsg('⚠ Fehler beim Speichern.')
    setTimeout(() => setMsg(''), 3000)
  }

  const startEdit = (v: VideoEntry) => {
    setEditId(v.id!)
    setForm({ ...v, year: v.year ?? '', day: v.day ?? '', subcategory: v.subcategory ?? '', tags: v.tags ?? '', thumbnailUrl: v.thumbnailUrl ?? '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => { setEditId(null); setForm(EMPTY_VIDEO) }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`„${title}" wirklich löschen?`)) return
    await fetch(`${API_BASE}/api/intern/videos/${id}`, { method: 'DELETE', credentials: 'include' })
    load()
  }

  const kategoriLabel: Record<string, string> = { SOMMER: '☀️ Sommerkonzert', WINTER: '❄️ Winterkonzert', WEITERE: '🎤 Weitere Auftritte' }

  const grouped = videos.reduce<Record<string, VideoEntry[]>>((acc, v) => {
    const key = v.category
    return { ...acc, [key]: [...(acc[key] ?? []), v] }
  }, {})

  return (
    <div className="space-y-6">
      {/* ── Formular ── */}
      <div className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4">
          <h3 className="font-bold text-white">{editId ? '✏️ Video bearbeiten' : '+ Video / Playlist hinzufügen'}</h3>
          <p className="mt-0.5 text-xs text-gray-400">
            Einfach den vollen YouTube-Link einfügen – ID und Typ werden automatisch erkannt. 🎉
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Zeile 1: Kategorie + Typ */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Kategorie *</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none">
                <option value="SOMMER">☀️ Sommerkonzert</option>
                <option value="WINTER">❄️ Winterkonzert</option>
                <option value="WEITERE">🎤 Weitere Auftritte</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Typ *</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none">
                <option value="VIDEO">▶ Video</option>
                <option value="PLAYLIST">☰ Playlist</option>
              </select>
            </div>
            {(form.category === 'SOMMER' || form.category === 'WINTER') && (
              <>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">Jahr</label>
                  <input value={form.year} onChange={e => set('year', e.target.value)}
                    placeholder="2024"
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white font-mono focus:border-green-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">Tag</label>
                  <select value={form.day} onChange={e => set('day', e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none">
                    <option value="">– kein Tag –</option>
                    <option>Montag</option>
                    <option>Dienstag</option>
                    <option>Mittwoch</option>
                    <option>Donnerstag</option>
                    <option>Freitag</option>
                    <option>Samstag</option>
                    <option>Sonntag</option>
                  </select>
                </div>
              </>
            )}
            {form.category === 'WEITERE' && (
              <>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-gray-400">Gruppe (z.B. Weihnachts Klüngel)</label>
                  <input value={form.subcategory} onChange={e => set('subcategory', e.target.value)}
                    placeholder="Weihnachts Klüngel"
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-gray-400">Tags (kommagetrennt, z.B. 2023, Waldniel)</label>
                  <input
                    value={(() => { try { return (JSON.parse(form.tags || '[]') as string[]).join(', ') } catch { return form.tags } })()}
                    onChange={e => set('tags', JSON.stringify(e.target.value.split(',').map(s => s.trim()).filter(Boolean)))}
                    placeholder="2023, Waldniel"
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none" />
                </div>
              </>
            )}
          </div>

          {/* Zeile 2: YT-URL/ID + Titel */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-400">YouTube-Link oder -ID *</label>
              <input
                value={form.youtubeId}
                onChange={e => {
                  const raw = e.target.value
                  const { id, type } = extractYouTubeId(raw)
                  // Wenn eine URL erkannt wurde: ID extrahieren + Typ automatisch setzen
                  if (type !== null && raw !== id) {
                    setForm(f => ({ ...f, youtubeId: id, type }))
                  } else {
                    set('youtubeId', raw)
                  }
                }}
                placeholder="https://youtube.com/watch?v=… oder PLxxxx"
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white font-mono focus:border-green-500 focus:outline-none"
              />
              {/* Vorschau: erkannter Typ + extrahierte ID */}
              {form.youtubeId && (
                <p className="mt-1 text-xs text-green-500/80">
                  {form.type === 'PLAYLIST' ? '☰ Playlist-ID:' : '▶ Video-ID:'}{' '}
                  <span className="font-mono">{form.youtubeId}</span>
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Titel *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="Sommerkonzert 2024 – Freitag Highlights"
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none" />
            </div>
          </div>

          {/* Zeile 3: Thumbnail (optional, besonders für Playlists) */}
          <ImageField
            label={`Thumbnail-Bild (optional${form.type === 'PLAYLIST' ? ' – empfohlen für Playlists' : ''})`}
            value={form.thumbnailUrl}
            onChange={v => set('thumbnailUrl', v)}
          />

          {/* Position */}
          <div className="w-32">
            <label className="mb-1 block text-xs text-gray-400">Sortierung (niedrig = vorne)</label>
            <input type="number" value={form.position} onChange={e => set('position', parseInt(e.target.value) || 0)}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white font-mono focus:border-green-500 focus:outline-none" />
          </div>

          {msg && <p className={`text-sm ${msg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">
              {saving ? 'Speichert…' : editId ? '✓ Aktualisieren' : '+ Hinzufügen'}
            </button>
            {editId && (
              <button type="button" onClick={cancelEdit}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-400 hover:text-white transition">
                Abbrechen
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Liste ── */}
      {loading ? (
        <p className="text-sm text-gray-400">Lade Videos…</p>
      ) : videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-12 text-center text-sm text-gray-500">
          Noch keine Videos vorhanden.
        </div>
      ) : (
        <div className="space-y-6">
          {(['SOMMER', 'WINTER', 'WEITERE'] as const).map(cat => {
            const items = grouped[cat] ?? []
            return (
              <div key={cat} className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
                <div className="border-b border-white/10 px-5 py-3">
                  <p className="font-semibold text-white text-sm">{kategoriLabel[cat]}
                    <span className="ml-2 rounded-full bg-slate-700 px-2 py-0.5 text-xs text-gray-400">{items.length}</span>
                  </p>
                </div>
                {items.length === 0 ? (
                  <p className="px-5 py-4 text-xs text-gray-600 italic">Noch keine Einträge.</p>
                ) : (
                  <div className="divide-y divide-white/5">
                    {items.map(v => (
                      <div key={v.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-800/40 transition">
                        {/* Mini-Thumbnail */}
                        {(v.thumbnailUrl || v.type === 'VIDEO') && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={v.thumbnailUrl || `https://img.youtube.com/vi/${v.youtubeId}/default.jpg`}
                            alt=""
                            className="h-10 w-16 rounded object-cover shrink-0 border border-white/10"
                          />
                        )}
                        {v.type === 'PLAYLIST' && !v.thumbnailUrl && (
                          <div className="h-10 w-16 rounded shrink-0 bg-slate-700 flex items-center justify-center border border-white/10">
                            <span className="text-xs text-gray-500">☰</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{v.title}</p>
                          <p className="mt-0.5 text-xs text-gray-500 font-mono">
                            {v.type === 'PLAYLIST' ? '☰' : '▶'} {v.youtubeId}
                            {v.year ? ` · ${v.year}` : ''}
                            {v.day ? ` – ${v.day}` : ''}
                            {v.subcategory ? ` · ${v.subcategory}` : ''}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <a href={`https://www.youtube.com/${v.type === 'PLAYLIST' ? `playlist?list=${v.youtubeId}` : `watch?v=${v.youtubeId}`}`}
                            target="_blank" rel="noopener noreferrer"
                            className="rounded px-2 py-1 text-xs bg-red-900/30 hover:bg-red-900/50 text-red-400 transition">↗ YT</a>
                          <button onClick={() => startEdit(v)}
                            className="rounded px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-gray-300 transition">✏️ Bearbeiten</button>
                          <button onClick={() => handleDelete(v.id!, v.title)}
                            className="rounded px-2 py-1 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 transition">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
