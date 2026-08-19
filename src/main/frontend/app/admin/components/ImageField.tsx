'use client'
import { getApiBase } from '@/lib/api'
import React, { useCallback, useEffect, useRef, useState } from 'react'

const API_BASE = getApiBase()

// ─── Von ImageField/AssetPickerModal gemeinsam genutzte Typen ──────────────────
// Diese Datei wird sowohl vom Seiten-/Sections-Editor (page.tsx, dort z.B. in
// PersonRosterForm und SponsorGridForm) als auch von mehreren ausgelagerten
// Admin-Tabs (VideosTab, MeldungenTab, SettingsTab) genutzt - daher zentral hier
// statt in einer der beiden Seiten dupliziert.
export interface AssetFile { key: string; size: number; lastModified: string; url: string }
export interface AssetListResponse { folders: string[]; files: AssetFile[]; prefix: string }

function isImage(key: string) { return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(key) }

// ─── Image Field ──────────────────────────────────────────────────────────────
export function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [showPicker, setShowPicker] = useState(false)
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">{label}</label>
      <div className="flex gap-2 items-center">
        <input value={value} onChange={e => onChange(e.target.value)}
          className="flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-green-500 focus:outline-none"
          placeholder="URL oder Bild aus R2 wählen" />
        <button type="button" onClick={() => setShowPicker(true)}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-slate-600 transition whitespace-nowrap">
          🖼 R2 wählen
        </button>
      </div>
      {value && isImage(value) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="Vorschau" className="mt-2 h-24 rounded-lg object-cover border border-white/10" />
      )}
      {showPicker && <AssetPickerModal onSelect={url => { onChange(url); setShowPicker(false) }} onClose={() => setShowPicker(false)} />}
    </div>
  )
}

// ─── Asset Picker Modal ───────────────────────────────────────────────────────
export function AssetPickerModal({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [data, setData] = useState<AssetListResponse>({ folders: [], files: [], prefix: '' })
  const [prefix, setPrefix] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async (p: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/assets?prefix=${encodeURIComponent(p)}`, { credentials: 'include' })
      if (res.ok) setData(await res.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(prefix) }, [load, prefix])

  const breadcrumbs = prefix.split('/').filter(Boolean)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    // Ensure folder doesn't end with '/' to avoid double slashes in the key
    const folder = (prefix || 'images').replace(/\/$/, '')
    const form = new FormData(); form.append('file', file); form.append('folder', folder)
    await fetch(`${API_BASE}/api/admin/assets/upload`, { method: 'POST', credentials: 'include', body: form })
    setUploading(false); if (fileRef.current) fileRef.current.value = ''; load(prefix)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="font-bold text-white">🗂 Bild aus R2 wählen</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-lg">✕</button>
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10 flex-wrap">
          <button type="button" onClick={() => setPrefix('')} className="text-xs text-green-400 hover:underline">Root</button>
          {breadcrumbs.map((b, i) => {
            const p = breadcrumbs.slice(0, i + 1).join('/') + '/'
            return <React.Fragment key={p}><span className="text-gray-500 mx-1">/</span>
              <button type="button" onClick={() => setPrefix(p)} className="text-xs text-green-400 hover:underline">{b}</button>
            </React.Fragment>
          })}
          <div className="ml-auto flex gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">
              {uploading ? 'Lädt…' : '↑ Hochladen'}
            </button>
          </div>
        </div>
        <div className="overflow-y-auto p-4">
          {loading ? <p className="text-sm text-gray-400">Lade…</p> : (
            <>
              {data.folders.length > 0 && (
                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {data.folders.map(f => (
                    <button type="button" key={f} onClick={() => setPrefix(f)}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-gray-300 hover:border-green-500/60 hover:text-white transition">
                      📁 <span className="truncate">{f.replace(prefix, '').replace(/\/$/, '')}</span>
                    </button>
                  ))}
                </div>
              )}
              {data.files.filter(f => isImage(f.key)).length === 0 && data.folders.length === 0 && (
                <p className="text-sm text-gray-500">Keine Bilder in diesem Ordner.</p>
              )}
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {data.files.filter(f => isImage(f.key)).map(a => (
                  <button type="button" key={a.key} onClick={() => onSelect(a.url)}
                    className="group overflow-hidden rounded-lg border border-white/10 hover:border-green-500/60 transition text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt={a.key} className="h-24 w-full object-cover group-hover:opacity-80 transition" />
                    <p className="truncate px-1 py-1 text-xs text-gray-400">{a.key.split('/').pop()}</p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
