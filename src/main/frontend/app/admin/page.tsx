'use client'
import { getApiBase } from '@/lib/api'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth, isAdmin, isBoard } from '@/lib/auth'
import { useRouter } from 'next/navigation'

const API_BASE = getApiBase()

interface AssetFile { key: string; size: number; lastModified: string; url: string }
interface AssetListResponse { folders: string[]; files: AssetFile[]; prefix: string }
interface SectionResponse { id: string; type: string; position: number; content: Record<string, unknown> }
interface PageMeta { id: string; slug: string; title: string; sections: SectionResponse[] }

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}
function isImage(key: string) { return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(key) }

// ─── Image Field ──────────────────────────────────────────────────────────────
function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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
function AssetPickerModal({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
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
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">✕</button>
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10 flex-wrap">
          <button onClick={() => setPrefix('')} className="text-xs text-green-400 hover:underline">Root</button>
          {breadcrumbs.map((b, i) => {
            const p = breadcrumbs.slice(0, i + 1).join('/') + '/'
            return <React.Fragment key={p}><span className="text-gray-500 mx-1">/</span>
              <button onClick={() => setPrefix(p)} className="text-xs text-green-400 hover:underline">{b}</button>
            </React.Fragment>
          })}
          <div className="ml-auto flex gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
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
                    <button key={f} onClick={() => setPrefix(f)}
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
                  <button key={a.key} onClick={() => onSelect(a.url)}
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

// ─── Section Form Fields ───────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:border-green-500 focus:outline-none" />
    </div>
  )
}

function HeroForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...content, [key]: val })
  return (
    <div className="flex flex-col gap-3">
      <Field label="Hauptüberschrift" value={String(content.headline ?? '')} onChange={v => set('headline', v)} />
      <Field label="Unterüberschrift" value={String(content.subheadline ?? '')} onChange={v => set('subheadline', v)} />
      <Field label="Button-Text (CTA)" value={String(content.ctaLabel ?? '')} onChange={v => set('ctaLabel', v)} />
      <Field label="Button-Link (CTA)" value={String(content.ctaHref ?? '')} onChange={v => set('ctaHref', v)} />
      <ImageField label="Hintergrundbild" value={String(content.backgroundImage ?? content.imageUrl ?? '')} onChange={v => set('backgroundImage', v)} />
    </div>
  )
}

function TextBlockForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...content, [key]: val })
  return (
    <div className="flex flex-col gap-3">
      <Field label="Überschrift" value={String(content.heading ?? '')} onChange={v => set('heading', v)} />
      <div>
        <label className="mb-1 block text-xs text-gray-400">Inhalt (Markdown)</label>
        <textarea value={String(content.markdown ?? '')} onChange={e => set('markdown', e.target.value)} rows={6}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-gray-200 focus:border-green-500 focus:outline-none resize-y" />
      </div>
      <ImageField label="Bild (optional)" value={String(content.imageUrl ?? '')} onChange={v => set('imageUrl', v)} />
    </div>
  )
}

interface EventItem { title: string; date: string; location: string; description: string; imageUrl?: string }
function EventCardForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const events: EventItem[] = (content.events as EventItem[]) ?? []
  const update = (i: number, key: string, val: string) =>
    onChange({ ...content, events: events.map((ev, idx) => idx === i ? { ...ev, [key]: val } : ev) })
  const add = () => onChange({ ...content, events: [...events, { title: 'Neues Event', date: '', location: '', description: '' }] })
  const remove = (i: number) => onChange({ ...content, events: events.filter((_, idx) => idx !== i) })
  return (
    <div className="flex flex-col gap-4">
      {events.map((ev, i) => (
        <div key={i} className="rounded-lg border border-white/10 bg-slate-900 p-3 flex flex-col gap-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-gray-300">Event {i + 1}</span>
            <button onClick={() => remove(i)} className="text-xs text-red-400 hover:text-red-300">✕ Entfernen</button>
          </div>
          <Field label="Titel" value={ev.title} onChange={v => update(i, 'title', v)} />
          <Field label="Datum" value={ev.date} onChange={v => update(i, 'date', v)} />
          <Field label="Ort" value={ev.location} onChange={v => update(i, 'location', v)} />
          <Field label="Beschreibung" value={ev.description} onChange={v => update(i, 'description', v)} />
          <ImageField label="Bild (optional)" value={ev.imageUrl ?? ''} onChange={v => update(i, 'imageUrl', v)} />
        </div>
      ))}
      <button onClick={add} className="rounded-lg border border-dashed border-white/20 py-2 text-sm text-gray-400 hover:text-white hover:border-green-500/60 transition">
        + Event hinzufügen
      </button>
    </div>
  )
}

// ─── Image Crop Modal ─────────────────────────────────────────────────────────
function ImageCropModal({ imageUrl, zoom, x, y, onSave, onClose }: {
  imageUrl: string; zoom: number; x: number; y: number
  onSave: (zoom: number, x: number, y: number) => void
  onClose: () => void
}) {
  const [curZoom, setCurZoom] = useState(zoom)
  const [curX, setCurX] = useState(x)
  const [curY, setCurY] = useState(y)
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
    e.preventDefault()
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return
    const dx = (e.clientX - lastPos.current.x) / curZoom
    const dy = (e.clientY - lastPos.current.y) / curZoom
    setCurX(v => v + dx)
    setCurY(v => v + dy)
    lastPos.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseUp = () => { dragging.current = false }
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setCurZoom(z => Math.min(4, Math.max(1, z - e.deltaY * 0.002)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 shadow-2xl p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white">🖼 Bild anpassen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">✕</button>
        </div>
        <p className="text-xs text-gray-400">Ziehen zum Verschieben · Scrollen oder Slider zum Zoomen</p>

        {/* Circular preview */}
        <div className="flex justify-center">
          <div
            className="h-52 w-52 overflow-hidden rounded-full ring-4 ring-green-500/60 relative cursor-grab active:cursor-grabbing select-none"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Vorschau"
              draggable={false}
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${curZoom}) translate(${curX}px, ${curY}px)`,
                transformOrigin: 'center',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        {/* Zoom slider */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">Zoom: {curZoom.toFixed(2)}×</label>
          <input type="range" min="1" max="4" step="0.05"
            value={curZoom}
            onChange={e => { const z = parseFloat(e.target.value); setCurZoom(z) }}
            className="w-full accent-green-500"
          />
        </div>

        <div className="flex gap-2">
          <button onClick={() => { setCurZoom(1); setCurX(0); setCurY(0) }}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 hover:text-white transition">
            Zurücksetzen
          </button>
          <button onClick={() => onSave(curZoom, curX, curY)}
            className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition">
            ✓ Übernehmen
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Person Grid Form ─────────────────────────────────────────────────────────
interface PersonItem {
  name: string
  role?: string
  roles?: string[]
  imageUrl?: string
  imageZoom?: number
  imageX?: number
  imageY?: number
  bio?: string
  email?: string
}

function PersonRolesEditor({ roles, onChange }: { roles: string[]; onChange: (r: string[]) => void }) {
  const [input, setInput] = useState('')
  const add = () => {
    const v = input.trim()
    if (v && !roles.includes(v)) { onChange([...roles, v]); setInput('') }
  }
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">Rollen / Funktionen</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {roles.map((r, i) => (
          <span key={i} className="flex items-center gap-1 rounded-full bg-green-900/40 border border-green-500/30 px-2.5 py-0.5 text-xs text-green-400">
            {r}
            <button onClick={() => onChange(roles.filter((_, idx) => idx !== i))} className="text-green-600 hover:text-red-400 ml-0.5">✕</button>
          </span>
        ))}
        {roles.length === 0 && <span className="text-xs text-gray-500">Noch keine Rollen</span>}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Neue Rolle eingeben…"
          className="flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-green-500 focus:outline-none" />
        <button onClick={add} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-slate-600 transition">+ Hinzufügen</button>
      </div>
    </div>
  )
}

function PersonGridForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const persons: PersonItem[] = (content.persons as PersonItem[]) ?? []
  const [cropIdx, setCropIdx] = useState<number | null>(null)
  const [pickerIdx, setPickerIdx] = useState<number | null>(null)

  const updatePerson = (i: number, patch: Partial<PersonItem>) =>
    onChange({ ...content, persons: persons.map((p, idx) => idx === i ? { ...p, ...patch } : p) })

  const add = () => onChange({ ...content, persons: [...persons, { name: 'Name', roles: ['Rolle'], imageUrl: '', bio: '' }] })
  const remove = (i: number) => onChange({ ...content, persons: persons.filter((_, idx) => idx !== i) })

  return (
    <div className="flex flex-col gap-4">
      <Field label="Überschrift" value={String(content.heading ?? '')} onChange={v => onChange({ ...content, heading: v })} />
      {persons.map((p, i) => {
        const roles = p.roles ?? (p.role ? [p.role] : [])
        return (
          <div key={i} className="rounded-lg border border-white/10 bg-slate-900 p-3 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-gray-300">Person {i + 1}</span>
              <button onClick={() => remove(i)} className="text-xs text-red-400 hover:text-red-300">✕ Entfernen</button>
            </div>
            <Field label="Name" value={p.name} onChange={v => updatePerson(i, { name: v })} />
            <PersonRolesEditor roles={roles} onChange={r => updatePerson(i, { roles: r, role: undefined })} />
            <Field label="Kurzbiografie" value={p.bio ?? ''} onChange={v => updatePerson(i, { bio: v })} />
            <Field label="E-Mail" value={p.email ?? ''} onChange={v => updatePerson(i, { email: v })} />

            {/* Image + crop */}
            <div>
              <label className="mb-1 block text-xs text-gray-400">Foto</label>
              <div className="flex gap-3 items-start">
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-green-500/40 relative bg-slate-800">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} style={{
                      position: 'absolute', width: '100%', height: '100%', objectFit: 'cover',
                      transform: `scale(${p.imageZoom ?? 1}) translate(${p.imageX ?? 0}px, ${p.imageY ?? 0}px)`,
                      transformOrigin: 'center',
                    }} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-green-400">
                      {p.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex gap-2">
                    <input value={p.imageUrl ?? ''} onChange={e => updatePerson(i, { imageUrl: e.target.value })}
                      placeholder="Bild-URL"
                      className="flex-1 rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-green-500 focus:outline-none" />
                    <button type="button" onClick={() => setPickerIdx(i)}
                      className="rounded-lg bg-slate-700 px-2 py-1.5 text-xs text-gray-300 hover:bg-slate-600 transition whitespace-nowrap">
                      🖼 R2
                    </button>
                  </div>
                  {p.imageUrl && (
                    <button onClick={() => setCropIdx(i)}
                      className="rounded-lg border border-green-500/30 bg-green-900/20 px-3 py-1.5 text-xs text-green-400 hover:bg-green-900/40 transition text-left">
                      ✂ Bild zoomen &amp; ausrichten
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
      <button onClick={add} className="rounded-lg border border-dashed border-white/20 py-2 text-sm text-gray-400 hover:text-white hover:border-green-500/60 transition">
        + Person hinzufügen
      </button>
      {cropIdx !== null && persons[cropIdx]?.imageUrl && (
        <ImageCropModal
          imageUrl={persons[cropIdx].imageUrl!}
          zoom={persons[cropIdx].imageZoom ?? 1}
          x={persons[cropIdx].imageX ?? 0}
          y={persons[cropIdx].imageY ?? 0}
          onSave={(zoom, x, y) => { updatePerson(cropIdx, { imageZoom: zoom, imageX: x, imageY: y }); setCropIdx(null) }}
          onClose={() => setCropIdx(null)}
        />
      )}
      {pickerIdx !== null && (
        <AssetPickerModal
          onSelect={url => { updatePerson(pickerIdx, { imageUrl: url }); setPickerIdx(null) }}
          onClose={() => setPickerIdx(null)}
        />
      )}
    </div>
  )
}

// ─── Next Concert Form ────────────────────────────────────────────────────────
function NextConcertForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  // reuse EventCardForm logic – same structure
  const events: EventItem[] = (content.events as EventItem[]) ?? []
  const update = (i: number, key: string, val: string) =>
    onChange({ ...content, events: events.map((ev, idx) => idx === i ? { ...ev, [key]: val } : ev) })
  const add = () => onChange({ ...content, events: [...events, { title: 'Konzert', date: '01.01.2026', location: 'Ort', description: '' }] })
  const remove = (i: number) => onChange({ ...content, events: events.filter((_, idx) => idx !== i) })
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-gray-400">Das nächste zukünftige Event aus dieser Liste wird automatisch angezeigt. Ist keines mehr aktuell, erscheint ein Hinweis.</p>
      {events.map((ev, i) => (
        <div key={i} className="rounded-lg border border-white/10 bg-slate-900 p-3 flex flex-col gap-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-gray-300">Konzert {i + 1}</span>
            <button onClick={() => remove(i)} className="text-xs text-red-400 hover:text-red-300">✕</button>
          </div>
          <Field label="Titel" value={ev.title} onChange={v => update(i, 'title', v)} />
          <Field label="Datum (TT.MM.JJJJ)" value={ev.date} onChange={v => update(i, 'date', v)} />
          <Field label="Ort" value={ev.location} onChange={v => update(i, 'location', v)} />
          <Field label="Beschreibung" value={ev.description} onChange={v => update(i, 'description', v)} />
        </div>
      ))}
      <button onClick={add} className="rounded-lg border border-dashed border-white/20 py-2 text-sm text-gray-400 hover:text-white hover:border-green-500/60 transition">
        + Konzert hinzufügen
      </button>
    </div>
  )
}

// ─── Band Grid Form ───────────────────────────────────────────────────────────
function BandGridForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  // Same as PersonGridForm but labeled "Band"
  const persons: PersonItem[] = (content.persons as PersonItem[]) ?? []
  const [cropIdx, setCropIdx] = useState<number | null>(null)
  const [pickerIdx, setPickerIdx] = useState<number | null>(null)
  const updatePerson = (i: number, patch: Partial<PersonItem>) =>
    onChange({ ...content, persons: persons.map((p, idx) => idx === i ? { ...p, ...patch } : p) })
  const add = () => onChange({ ...content, persons: [...persons, { name: 'Name', roles: ['Instrument'], imageUrl: '' }] })
  const remove = (i: number) => onChange({ ...content, persons: persons.filter((_, idx) => idx !== i) })
  return (
    <div className="flex flex-col gap-4">
      <Field label="Überschrift" value={String(content.heading ?? '')} onChange={v => onChange({ ...content, heading: v })} />
      {persons.map((p, i) => {
        const roles = p.roles ?? (p.role ? [p.role] : [])
        return (
          <div key={i} className="rounded-lg border border-white/10 bg-slate-900 p-3 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-gray-300">Mitglied {i + 1}</span>
              <button onClick={() => remove(i)} className="text-xs text-red-400 hover:text-red-300">✕</button>
            </div>
            <Field label="Name" value={p.name} onChange={v => updatePerson(i, { name: v })} />
            <PersonRolesEditor roles={roles} onChange={r => updatePerson(i, { roles: r, role: undefined })} />
            <div className="flex gap-3 items-start">
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-purple-500/40 relative bg-slate-800">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${p.imageZoom ?? 1}) translate(${p.imageX ?? 0}px, ${p.imageY ?? 0}px)`, transformOrigin: 'center' }} />
                ) : <div className="flex h-full w-full items-center justify-center text-xl font-bold text-purple-400">{p.name.charAt(0)}</div>}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex gap-2">
                  <input value={p.imageUrl ?? ''} onChange={e => updatePerson(i, { imageUrl: e.target.value })} placeholder="Bild-URL"
                    className="flex-1 rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-green-500 focus:outline-none" />
                  <button type="button" onClick={() => setPickerIdx(i)} className="rounded-lg bg-slate-700 px-2 py-1.5 text-xs text-gray-300 hover:bg-slate-600 transition">🖼 R2</button>
                </div>
                {p.imageUrl && <button onClick={() => setCropIdx(i)} className="rounded-lg border border-purple-500/30 bg-purple-900/20 px-3 py-1.5 text-xs text-purple-400 hover:bg-purple-900/40 transition">✂ Zoomen & ausrichten</button>}
              </div>
            </div>
          </div>
        )
      })}
      <button onClick={add} className="rounded-lg border border-dashed border-white/20 py-2 text-sm text-gray-400 hover:text-white hover:border-green-500/60 transition">
        + Mitglied hinzufügen
      </button>
      {cropIdx !== null && persons[cropIdx]?.imageUrl && (
        <ImageCropModal imageUrl={persons[cropIdx].imageUrl!} zoom={persons[cropIdx].imageZoom ?? 1} x={persons[cropIdx].imageX ?? 0} y={persons[cropIdx].imageY ?? 0}
          onSave={(zoom, x, y) => { updatePerson(cropIdx, { imageZoom: zoom, imageX: x, imageY: y }); setCropIdx(null) }} onClose={() => setCropIdx(null)} />
      )}
      {pickerIdx !== null && <AssetPickerModal onSelect={url => { updatePerson(pickerIdx, { imageUrl: url }); setPickerIdx(null) }} onClose={() => setPickerIdx(null)} />}
    </div>
  )
}

// ─── ChoirList Form ───────────────────────────────────────────────────────────
function ChoirListForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  interface Voice { name: string; members: string[] }
  const voices: Voice[] = (content.voices as Voice[]) ?? []
  const updateVoice = (i: number, patch: Partial<Voice>) =>
    onChange({ ...content, voices: voices.map((v, idx) => idx === i ? { ...v, ...patch } : v) })
  const addVoice = () => onChange({ ...content, voices: [...voices, { name: 'Neue Stimme', members: [] }] })
  const removeVoice = (i: number) => onChange({ ...content, voices: voices.filter((_, idx) => idx !== i) })
  const updateMembers = (i: number, raw: string) =>
    updateVoice(i, { members: raw.split('\n').map(s => s.trim()).filter(Boolean) })
  return (
    <div className="flex flex-col gap-3">
      <Field label="Überschrift" value={String(content.heading ?? '')} onChange={v => onChange({ ...content, heading: v })} />
      <Field label="Dirigent/in" value={String(content.conductor ?? '')} onChange={v => onChange({ ...content, conductor: v })} />
      {voices.map((v, i) => (
        <div key={i} className="rounded-lg border border-white/10 bg-slate-900 p-3 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <Field label="Stimmlage" value={v.name} onChange={n => updateVoice(i, { name: n })} />
            <button onClick={() => removeVoice(i)} className="ml-2 text-xs text-red-400 hover:text-red-300 mt-4">✕</button>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Mitglieder (je Zeile ein Name)</label>
            <textarea value={v.members.join('\n')} onChange={e => updateMembers(i, e.target.value)} rows={4}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-gray-200 focus:border-green-500 focus:outline-none resize-y" />
          </div>
        </div>
      ))}
      <button onClick={addVoice} className="rounded-lg border border-dashed border-white/20 py-2 text-sm text-gray-400 hover:text-white hover:border-green-500/60 transition">
        + Stimmlage hinzufügen
      </button>
    </div>
  )
}

// ─── ImageCaption Form ────────────────────────────────────────────────────────
function ImageCaptionForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <ImageField label="Bild" value={String(content.imageUrl ?? '')} onChange={v => onChange({ ...content, imageUrl: v })} />
      <Field label="Bildunterschrift" value={String(content.caption ?? '')} onChange={v => onChange({ ...content, caption: v })} />
      <Field label="Alt-Text" value={String(content.altText ?? '')} onChange={v => onChange({ ...content, altText: v })} />
    </div>
  )
}

// ─── TermineList Form ─────────────────────────────────────────────────────────
function TermineListForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  interface ParkingItem { name?: string; mapUrl: string }
  interface TerminItem { title: string; date: string; time?: string; location?: string; mapUrl?: string; parking?: ParkingItem[]; note?: string; kategorie: string }
  const termine: TerminItem[] = (content.termine as TerminItem[]) ?? []
  const KATEGORIEN = ['konzert', 'jugend', 'ausflug', 'sonstige']
  const KAT_ICONS: Record<string, string> = { konzert: '🎸', jugend: '🏕️', ausflug: '🚌', sonstige: '📅' }

  const update = (i: number, patch: Partial<TerminItem>) =>
    onChange({ ...content, termine: termine.map((t, idx) => idx === i ? { ...t, ...patch } : t) })
  const add = () => onChange({ ...content, termine: [...termine, { title: 'Neuer Termin', date: '01.01.2026', location: '', kategorie: 'sonstige' }] })
  const remove = (i: number) => onChange({ ...content, termine: termine.filter((_, idx) => idx !== i) })
  const addParking = (i: number) => { const t = termine[i]; update(i, { parking: [...(t.parking ?? []), { name: '', mapUrl: '' }] }) }
  const updateParking = (ti: number, pi: number, patch: Partial<ParkingItem>) => {
    const t = termine[ti]; update(ti, { parking: (t.parking ?? []).map((p, idx) => idx === pi ? { ...p, ...patch } : p) })
  }
  const removeParking = (ti: number, pi: number) => {
    const t = termine[ti]; update(ti, { parking: (t.parking ?? []).filter((_, idx) => idx !== pi) })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <div className="flex-1"><Field label="Überschrift" value={String(content.heading ?? 'Termine')} onChange={v => onChange({ ...content, heading: v })} /></div>
        <div className="w-24"><Field label="Jahr" value={String(content.year ?? '')} onChange={v => onChange({ ...content, year: v })} /></div>
      </div>
      {termine.map((t, i) => (
        <div key={i} className="rounded-lg border border-white/10 bg-slate-900 p-3 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-300">Termin {i + 1}</span>
            <button onClick={() => remove(i)} className="text-xs text-red-400 hover:text-red-300">✕</button>
          </div>
          <Field label="Bezeichnung" value={t.title} onChange={v => update(i, { title: v })} />
          <div className="flex gap-2">
            <div className="flex-1"><Field label="Datum" value={t.date} onChange={v => update(i, { date: v })} /></div>
            <div className="w-28"><Field label="Uhrzeit" value={t.time ?? ''} onChange={v => update(i, { time: v })} /></div>
          </div>
          <Field label="Ort (Anzeige)" value={t.location ?? ''} onChange={v => update(i, { location: v })} />
          <Field label="📍 Google-Maps-Link (optional)" value={t.mapUrl ?? ''} onChange={v => update(i, { mapUrl: v })} placeholder="https://maps.google.com/?q=..." />
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-gray-400">🅿️ Parkplätze</label>
              <button onClick={() => addParking(i)} className="text-xs text-green-400 hover:text-green-300 transition">+ hinzufügen</button>
            </div>
            {(t.parking ?? []).map((p, pi) => (
              <div key={pi} className="flex gap-2 mb-1 items-center">
                <input value={p.name ?? ''} onChange={e => updateParking(i, pi, { name: e.target.value })} placeholder="Name (z.B. Marktplatz-Parkhaus)"
                  className="flex-1 rounded-lg border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white placeholder-gray-600 focus:border-green-500 focus:outline-none" />
                <input value={p.mapUrl} onChange={e => updateParking(i, pi, { mapUrl: e.target.value })} placeholder="Maps-Link"
                  className="flex-[2] rounded-lg border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white font-mono placeholder-gray-600 focus:border-green-500 focus:outline-none" />
                <button onClick={() => removeParking(i, pi)} className="text-xs text-red-400 hover:text-red-300 px-1">✕</button>
              </div>
            ))}
            {(t.parking ?? []).length === 0 && <p className="text-xs text-gray-600 italic">Kein Parkplatz konfiguriert</p>}
          </div>
          <Field label="Hinweis" value={t.note ?? ''} onChange={v => update(i, { note: v })} />
          <div>
            <label className="mb-1 block text-xs text-gray-400">Kategorie</label>
            <div className="flex gap-2 flex-wrap">
              {KATEGORIEN.map(k => (
                <button key={k} type="button" onClick={() => update(i, { kategorie: k })}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${t.kategorie === k ? 'bg-green-900/40 border-green-500/40 text-green-400' : 'bg-slate-800 border-white/10 text-gray-400 hover:text-white'}`}>
                  {KAT_ICONS[k]} {k}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
      <button onClick={add} className="rounded-lg border border-dashed border-white/20 py-2 text-sm text-gray-400 hover:text-white hover:border-green-500/60 transition">
        + Termin hinzufügen
      </button>
    </div>
  )
}

// ─── ActivityGrid Form ────────────────────────────────────────────────────────
function ActivityGridForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  interface ActivityItem { title: string; text: string; icon?: string; accent?: string; targetGroup?: string }
  const items: ActivityItem[] = (content.items as ActivityItem[]) ?? []
  const ACCENTS = ['green', 'amber', 'blue', 'purple', 'red']
  const ACCENT_ICONS: Record<string, string> = { green: '🟢', amber: '🟡', blue: '🔵', purple: '🟣', red: '🔴' }

  const update = (i: number, patch: Partial<ActivityItem>) =>
    onChange({ ...content, items: items.map((it, idx) => idx === i ? { ...it, ...patch } : it) })
  const add = () => onChange({ ...content, items: [...items, { title: 'Neue Aktivität', text: '', icon: '🎯', accent: 'green' }] })
  const remove = (i: number) => onChange({ ...content, items: items.filter((_, idx) => idx !== i) })

  return (
    <div className="flex flex-col gap-4">
      <Field label="Überschrift" value={String(content.heading ?? '')} onChange={v => onChange({ ...content, heading: v })} />
      <div>
        <label className="mb-1 block text-xs text-gray-400">Einleitungstext</label>
        <textarea value={String(content.intro ?? '')} onChange={e => onChange({ ...content, intro: e.target.value })} rows={3}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-gray-200 focus:border-green-500 focus:outline-none resize-y" />
      </div>
      {items.map((it, i) => (
        <div key={i} className="rounded-lg border border-white/10 bg-slate-900 p-3 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-300">Aktivität {i + 1}</span>
            <button onClick={() => remove(i)} className="text-xs text-red-400 hover:text-red-300">✕</button>
          </div>
          <div className="flex gap-2">
            <div className="w-20"><Field label="Icon (Emoji)" value={it.icon ?? ''} onChange={v => update(i, { icon: v })} placeholder="🏕️" /></div>
            <div className="flex-1"><Field label="Titel" value={it.title} onChange={v => update(i, { title: v })} /></div>
          </div>
          <Field label="Zielgruppe (optional)" value={it.targetGroup ?? ''} onChange={v => update(i, { targetGroup: v })} placeholder="z.B. Kinder 8–12 Jahre" />
          <div>
            <label className="mb-1 block text-xs text-gray-400">Beschreibungstext</label>
            <textarea value={it.text} onChange={e => update(i, { text: e.target.value })} rows={3}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-gray-200 focus:border-green-500 focus:outline-none resize-y" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Farbe</label>
            <div className="flex gap-2 flex-wrap">
              {ACCENTS.map(a => (
                <button key={a} type="button" onClick={() => update(i, { accent: a })}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${it.accent === a ? 'bg-green-900/40 border-green-500/40 text-green-400' : 'bg-slate-800 border-white/10 text-gray-400 hover:text-white'}`}>
                  {ACCENT_ICONS[a]} {a}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
      <button onClick={add} className="rounded-lg border border-dashed border-white/20 py-2 text-sm text-gray-400 hover:text-white hover:border-green-500/60 transition">
        + Aktivität hinzufügen
      </button>
    </div>
  )
}

// ─── SponsorGrid Form ─────────────────────────────────────────────────────────
interface SponsorLocationItem { name?: string; address: string; mapUrl?: string; phone?: string }
interface SponsorItem {
  name: string; person?: string; imageUrl?: string; address?: string; mapUrl?: string
  website?: string; phone?: string; mobile?: string; email?: string
  locations?: SponsorLocationItem[]
}

function SponsorLocationsEditor({ locations, onChange }: { locations: SponsorLocationItem[]; onChange: (l: SponsorLocationItem[]) => void }) {
  const update = (i: number, patch: Partial<SponsorLocationItem>) =>
    onChange(locations.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  const add = () => onChange([...locations, { address: '' }])
  const remove = (i: number) => onChange(locations.filter((_, idx) => idx !== i))
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs text-gray-400">Standorte</label>
        <button onClick={add} className="text-xs text-green-400 hover:text-green-300">+ Standort</button>
      </div>
      {locations.map((loc, i) => (
        <div key={i} className="mb-2 rounded-lg border border-white/10 bg-slate-800 p-2 flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Standort {i + 1}</span>
            <button onClick={() => remove(i)} className="text-xs text-red-400">✕</button>
          </div>
          <input value={loc.name ?? ''} onChange={e => update(i, { name: e.target.value })} placeholder="Name (z.B. REWE Markt Amern)"
            className="w-full rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white focus:border-green-500 focus:outline-none" />
          <input value={loc.address} onChange={e => update(i, { address: e.target.value })} placeholder="Adresse"
            className="w-full rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white focus:border-green-500 focus:outline-none" />
          <input value={loc.mapUrl ?? ''} onChange={e => update(i, { mapUrl: e.target.value })} placeholder="Google-Maps-Link (optional)"
            className="w-full rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white font-mono focus:border-green-500 focus:outline-none" />
          <input value={loc.phone ?? ''} onChange={e => update(i, { phone: e.target.value })} placeholder="Telefon (optional)"
            className="w-full rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white focus:border-green-500 focus:outline-none" />
        </div>
      ))}
    </div>
  )
}

function SponsorGridForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const sponsors: SponsorItem[] = (content.sponsors as SponsorItem[]) ?? []
  const [pickerIdx, setPickerIdx] = useState<number | null>(null)

  const update = (i: number, patch: Partial<SponsorItem>) =>
    onChange({ ...content, sponsors: sponsors.map((s, idx) => idx === i ? { ...s, ...patch } : s) })
  const add = () => onChange({ ...content, sponsors: [...sponsors, { name: 'Neuer Sponsor' }] })
  const remove = (i: number) => onChange({ ...content, sponsors: sponsors.filter((_, idx) => idx !== i) })
  const move = (i: number, dir: -1 | 1) => {
    const arr = [...sponsors]
    const j = i + dir
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]]
    onChange({ ...content, sponsors: arr })
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Überschrift" value={String(content.heading ?? '')} onChange={v => onChange({ ...content, heading: v })} />
      <div>
        <label className="mb-1 block text-xs text-gray-400">Einleitungstext</label>
        <textarea value={String(content.intro ?? '')} onChange={e => onChange({ ...content, intro: e.target.value })} rows={2}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-gray-200 focus:border-green-500 focus:outline-none resize-y" />
      </div>
      <p className="text-xs text-gray-500">{sponsors.length} Sponsoren – werden alphabetisch per Namen sortiert angezeigt wie eingegeben.</p>
      {sponsors.map((s, i) => (
        <div key={i} className="rounded-lg border border-white/10 bg-slate-900 p-3 flex flex-col gap-2">
          <div className="flex justify-between items-center flex-wrap gap-1">
            <span className="text-xs font-bold text-gray-300">Sponsor {i + 1}</span>
            <div className="flex gap-1">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-xs text-gray-500 hover:text-white px-1 disabled:opacity-30">↑</button>
              <button onClick={() => move(i, 1)} disabled={i === sponsors.length - 1} className="text-xs text-gray-500 hover:text-white px-1 disabled:opacity-30">↓</button>
              <button onClick={() => remove(i)} className="text-xs text-red-400 hover:text-red-300 ml-1">✕ Entfernen</button>
            </div>
          </div>
          <Field label="Firmenname *" value={s.name} onChange={v => update(i, { name: v })} />
          <Field label="Kontaktperson (optional)" value={s.person ?? ''} onChange={v => update(i, { person: v })} placeholder="z.B. Nina Winkler" />

          {/* Bild */}
          <div>
            <label className="mb-1 block text-xs text-gray-400">Logo / Bild</label>
            <div className="flex gap-2">
              <input value={s.imageUrl ?? ''} onChange={e => update(i, { imageUrl: e.target.value })} placeholder="Bild-URL"
                className="flex-1 rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-green-500 focus:outline-none" />
              <button type="button" onClick={() => setPickerIdx(i)} className="rounded-lg bg-slate-700 px-2 py-1.5 text-xs text-gray-300 hover:bg-slate-600 transition">🖼 R2</button>
            </div>
          </div>

          {/* Einzel-Adresse ODER Standorte */}
          {(!s.locations || s.locations.length === 0) ? (
            <>
              <Field label="Adresse" value={s.address ?? ''} onChange={v => update(i, { address: v })} placeholder="Straße, PLZ Ort" />
              <Field label="Google-Maps-Link (optional)" value={s.mapUrl ?? ''} onChange={v => update(i, { mapUrl: v })} placeholder="https://maps.google.com/..." />
            </>
          ) : null}

          {/* Mehrere Standorte */}
          <SponsorLocationsEditor
            locations={s.locations ?? []}
            onChange={locs => update(i, { locations: locs.length > 0 ? locs : undefined, address: locs.length > 0 ? undefined : s.address })}
          />
          {(!s.locations || s.locations.length === 0) && (
            <button onClick={() => update(i, { locations: [{ address: s.address ?? '' }], address: undefined, mapUrl: undefined })}
              className="text-xs text-blue-400 hover:text-blue-300 text-left">
              + Mehrere Standorte hinzufügen
            </button>
          )}

          <Field label="Website" value={s.website ?? ''} onChange={v => update(i, { website: v })} placeholder="www.beispiel.de" />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Telefon" value={s.phone ?? ''} onChange={v => update(i, { phone: v })} placeholder="02163 1234" />
            <Field label="Handy" value={s.mobile ?? ''} onChange={v => update(i, { mobile: v })} placeholder="0172 ..." />
          </div>
          <Field label="E-Mail" value={s.email ?? ''} onChange={v => update(i, { email: v })} placeholder="info@beispiel.de" />
        </div>
      ))}
      <button onClick={add} className="rounded-lg border border-dashed border-white/20 py-2 text-sm text-gray-400 hover:text-white hover:border-green-500/60 transition">
        + Sponsor hinzufügen
      </button>
      {pickerIdx !== null && (
        <AssetPickerModal
          onSelect={url => { update(pickerIdx, { imageUrl: url }); setPickerIdx(null) }}
          onClose={() => setPickerIdx(null)}
        />
      )}
    </div>
  )
}

// ─── Section Editor ───────────────────────────────────────────────────────────
function SectionEditor({ section, pageSlug, onSaved, onDeleted }: {
  section: SectionResponse; pageSlug: string; onSaved: () => void; onDeleted: () => void
}) {
  const [content, setContent] = useState<Record<string, unknown>>(section.content)
  const [expertMode, setExpertMode] = useState(false)
  const [rawJson, setRawJson] = useState(JSON.stringify(section.content, null, 2))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true); setError('')
    let parsed = content
    if (expertMode) {
      try { parsed = JSON.parse(rawJson) } catch { setError('Ungültiges JSON.'); setSaving(false); return }
    }
    try {
      const res = await fetch(`${API_BASE}/api/pages/${pageSlug}/sections/${section.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: section.type, position: section.position, content: parsed }),
      })
      if (res.ok) onSaved(); else setError('Speichern fehlgeschlagen.')
    } catch { setError('Fehler.') } finally { setSaving(false) }
  }

  const del = async () => {
    if (!confirm('Sektion wirklich löschen?')) return
    await fetch(`${API_BASE}/api/pages/${pageSlug}/sections/${section.id}`, { method: 'DELETE', credentials: 'include' })
    onDeleted()
  }

  const toggleExpert = () => {
    if (!expertMode) setRawJson(JSON.stringify(content, null, 2))
    else { try { setContent(JSON.parse(rawJson)) } catch { /* keep */ } }
    setExpertMode(e => !e)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4">
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <span className="rounded bg-green-900/40 px-2 py-0.5 text-xs font-mono font-bold text-green-400">{section.type}</span>
        <div className="flex gap-2 flex-wrap">
          <button onClick={toggleExpert}
            className={`rounded px-2 py-1 text-xs transition ${expertMode ? 'bg-yellow-800/40 text-yellow-400' : 'bg-slate-700 text-gray-400 hover:text-white'}`}>
            {expertMode ? '🔧 Expertenmode (aktiv)' : '🔧 Expertenmode'}
          </button>
          <button onClick={del} className="rounded px-2 py-1 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 transition">Löschen</button>
        </div>
      </div>

      {expertMode ? (
        <textarea value={rawJson} onChange={e => setRawJson(e.target.value)} rows={10}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 font-mono text-xs text-gray-200 focus:border-green-500 focus:outline-none resize-y" />
      ) : (
        <div className="mb-3">
          {section.type === 'HERO'          && <HeroForm content={content} onChange={setContent} />}
          {section.type === 'TEXT_BLOCK'    && <TextBlockForm content={content} onChange={setContent} />}
          {section.type === 'EVENT_CARD'    && <EventCardForm content={content} onChange={setContent} />}
          {section.type === 'PERSON_GRID'   && <PersonGridForm content={content} onChange={setContent} />}
          {section.type === 'NEXT_CONCERT'  && <NextConcertForm content={content} onChange={setContent} />}
          {section.type === 'BAND_GRID'     && <BandGridForm content={content} onChange={setContent} />}
          {section.type === 'CHOIR_LIST'    && <ChoirListForm content={content} onChange={setContent} />}
          {section.type === 'IMAGE_CAPTION' && <ImageCaptionForm content={content} onChange={setContent} />}
          {section.type === 'TERMINE_LIST'  && <TermineListForm content={content} onChange={setContent} />}
          {section.type === 'ACTIVITY_GRID' && <ActivityGridForm content={content} onChange={setContent} />}
          {section.type === 'SPONSOR_GRID'  && <SponsorGridForm content={content} onChange={setContent} />}
        </div>
      )}

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      <button onClick={save} disabled={saving}
        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">
        {saving ? 'Speichert…' : '✓ Speichern'}
      </button>
    </div>
  )
}

// ─── Nav Config Editor ────────────────────────────────────────────────────────
type NavVisibility = 'public' | 'member' | 'admin' | 'guest'
interface AdminNavDropdownGroup { label: string; target?: string; items: string[]; visibility?: NavVisibility }
interface AdminNavFixedLink { label: string; href: string; visibility?: NavVisibility; items?: { label: string; href: string }[] }
interface AdminNavConfig { dropdowns: AdminNavDropdownGroup[]; hidden?: string[]; fixedLinks?: AdminNavFixedLink[] }

const VISIBILITY_OPTIONS: { value: NavVisibility; label: string; icon: string }[] = [
  { value: 'public',  label: 'Alle',                          icon: '🌍' },
  { value: 'member',  label: 'Angemeldet',                    icon: '👤' },
  { value: 'admin',   label: 'Nur Admin',                     icon: '🔑' },
  { value: 'guest',   label: 'Nur Gäste (nicht angemeldet)',  icon: '👻' },
]

function VisibilitySelect({ value, onChange }: { value: NavVisibility | undefined; onChange: (v: NavVisibility) => void }) {
  const cur = value ?? 'public'
  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">Sichtbar für</label>
      <div className="flex gap-1.5 flex-wrap">
        {VISIBILITY_OPTIONS.map(o => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition
              ${cur === o.value ? 'border-green-500 bg-green-900/20 text-green-400' : 'border-white/10 bg-slate-800 text-gray-500 hover:text-white hover:border-white/30'}`}>
            {o.icon} {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function normalizeAdminNavConfig(raw: Record<string, unknown>): AdminNavConfig {
  if (Array.isArray(raw.dropdowns)) return raw as unknown as AdminNavConfig
  const dropdowns: AdminNavDropdownGroup[] = []
  if (Array.isArray(raw.ueberUns)) dropdowns.push({ label: 'Über uns', target: undefined, items: raw.ueberUns as string[] })
  if (Array.isArray(raw.vereinsleben)) dropdowns.push({ label: 'Vereinsleben', items: raw.vereinsleben as string[] })
  return { dropdowns, hidden: raw.hidden as string[] | undefined }
}

function NavConfigEditor({ settings, setSettings, allPages, reloadPages }: {
  settings: Record<string, string>
  setSettings: (s: Record<string, string>) => void
  allPages: { slug: string; title: string }[]
  reloadPages: () => void
}) {
  const getConfig = (): AdminNavConfig => {
    try { return normalizeAdminNavConfig(JSON.parse(settings.nav_config || '{}')) }
    catch { return { dropdowns: [] } }
  }
  const cfg = getConfig()
  const save = (next: AdminNavConfig) => setSettings({ ...settings, nav_config: JSON.stringify(next) })

  const pages = Array.isArray(allPages) ? allPages.filter(p => p.slug !== 'home') : []
  const inDropdown = new Set(cfg.dropdowns.flatMap(g => g.items))
  const hiddenSet = new Set(cfg.hidden ?? [])
  const fixedLinks: AdminNavFixedLink[] = cfg.fixedLinks ?? [{ label: 'Intern', href: '/intern', visibility: 'member' }]

  const updateGroup = (i: number, patch: Partial<AdminNavDropdownGroup>) =>
    save({ ...cfg, dropdowns: cfg.dropdowns.map((g, idx) => idx === i ? { ...g, ...patch } : g) })
  const addGroup = () => save({ ...cfg, dropdowns: [...cfg.dropdowns, { label: 'Neues Menü', items: [], visibility: 'public' }] })
  const removeGroup = (i: number) => save({ ...cfg, dropdowns: cfg.dropdowns.filter((_, idx) => idx !== i) })
  const toggleItem = (groupIdx: number, slug: string) => {
    const g = cfg.dropdowns[groupIdx]
    const next = g.items.includes(slug) ? g.items.filter(s => s !== slug) : [...g.items, slug]
    updateGroup(groupIdx, { items: next })
  }
  const toggleHidden = (slug: string) => {
    const h = cfg.hidden ?? []
    save({ ...cfg, hidden: h.includes(slug) ? h.filter(s => s !== slug) : [...h, slug] })
  }
  const saveFixedLinks = (links: AdminNavFixedLink[]) => save({ ...cfg, fixedLinks: links })
  const updateFixedLink = (i: number, patch: Partial<AdminNavFixedLink>) =>
    saveFixedLinks(fixedLinks.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  const addFixedLink = () => saveFixedLinks([...fixedLinks, { label: 'Neuer Link', href: '/', visibility: 'member' }])
  const removeFixedLink = (i: number) => saveFixedLinks(fixedLinks.filter((_, idx) => idx !== i))

  const createPageForSlug = async (slug: string, label: string) => {
    const title = label || slug
    await fetch(`${API_BASE}/api/pages`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, title }),
    })
    reloadPages()
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-800/40 p-6 space-y-6">
      <div>
        <h3 className="mb-1 text-base font-bold text-white">🗂 Navigation konfigurieren</h3>
        <p className="text-xs text-gray-400">
          Erstelle Dropdown-Menüs und feste Links. Jedes Element hat eine <strong className="text-gray-300">Sichtbarkeitsregel</strong> –
          z.&nbsp;B. „Intern" nur für angemeldete Mitglieder.
        </p>
      </div>

      {/* Fixed: Startseite */}
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3">
        <span className="font-mono text-xs text-gray-500">/</span>
        <span className="flex-1 text-sm text-gray-400">Startseite</span>
        <span className="rounded-full bg-slate-700 px-3 py-1 text-xs text-gray-500 border border-white/10">🔒 Immer sichtbar</span>
      </div>

      {/* Dropdown groups */}
      {cfg.dropdowns.map((group, gi) => (
        <div key={gi} className="rounded-xl border border-white/10 bg-slate-900/60 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Dropdown-Menü {gi + 1}</span>
            <button onClick={() => removeGroup(gi)} className="ml-auto text-xs text-red-400 hover:text-red-300 transition">✕ Entfernen</button>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-300">
              Anzeigename <span className="font-normal text-gray-500">(kein echter Seitenlink nötig)</span>
            </label>
            <input value={group.label} onChange={e => updateGroup(gi, { label: e.target.value })}
              placeholder="z. B. Über uns"
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-green-500 focus:outline-none" />
          </div>

          <VisibilitySelect value={group.visibility} onChange={v => updateGroup(gi, { visibility: v })} />

          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-300">Verhalten beim Klick auf den Namen</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => updateGroup(gi, { target: undefined })}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition
                  ${!group.target ? 'border-green-500 bg-green-900/20 text-green-400' : 'border-white/10 bg-slate-800 text-gray-400 hover:border-white/30 hover:text-white'}`}>
                ▾ Nur Dropdown öffnen
              </button>
              <button type="button" onClick={() => { if (!group.target) updateGroup(gi, { target: pages[0]?.slug ?? '' }) }}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition
                  ${group.target !== undefined && group.target !== ''
                    ? 'border-blue-500 bg-blue-900/20 text-blue-400'
                    : 'border-white/10 bg-slate-800 text-gray-400 hover:border-white/30 hover:text-white'}`}>
                🔗 Auf Seite weiterleiten
              </button>
            </div>
            {group.target !== undefined && group.target !== '' && (
              <div className="mt-2">
                <label className="mb-1 block text-xs text-gray-400">Zielseite bei Klick auf „{group.label}"</label>
                <select value={group.target} onChange={e => updateGroup(gi, { target: e.target.value || undefined })}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none">
                  <option value="">— Seite auswählen —</option>
                  {pages.map(p => <option key={p.slug} value={p.slug}>/{p.slug} – {p.title}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-300">
              Seiten in diesem Dropdown <span className="font-normal text-gray-500">({group.items.length} ausgewählt)</span>
            </label>
            {pages.length === 0
              ? <p className="text-xs text-gray-500 italic">Keine Seiten geladen…</p>
              : <div className="flex flex-col divide-y divide-white/5 rounded-lg border border-white/10 overflow-hidden">
                  {/* Verwaiste Slugs: in group.items, aber keine passende Seite */}
                  {group.items.filter(slug => !pages.find(p => p.slug === slug)).map(slug => (
                    <button key={`orphan-${slug}`} type="button" onClick={() => toggleItem(gi, slug)}
                      className="flex items-center gap-3 px-3 py-2.5 text-left text-sm transition bg-yellow-900/20 text-yellow-400 hover:bg-yellow-900/40">
                      <span className="h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 bg-yellow-500 border-yellow-500">
                        <span className="text-white text-xs">✓</span>
                      </span>
                      <span className="font-mono text-xs text-yellow-600 w-28 truncate">/{slug}</span>
                      <span className="flex-1 truncate italic text-yellow-500/70">⚠ Seite nicht gefunden</span>
                      <span className="text-xs text-yellow-600/60">→ klicken zum Entfernen</span>
                    </button>
                  ))}
                  {pages.map(p => {
                    const checked = group.items.includes(p.slug)
                    return (
                      <button key={p.slug} type="button" onClick={() => toggleItem(gi, p.slug)}
                        className={`flex items-center gap-3 px-3 py-2.5 text-left text-sm transition
                          ${checked ? 'bg-green-900/20 text-green-400' : 'bg-slate-900 text-gray-400 hover:bg-slate-800 hover:text-white'}`}>
                        <span className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0
                          ${checked ? 'bg-green-500 border-green-500' : 'border-white/20'}`}>
                          {checked && <span className="text-white text-xs">✓</span>}
                        </span>
                        <span className="font-mono text-xs text-gray-500 w-28 truncate">/{p.slug}</span>
                        <span className="flex-1 truncate">{p.title}</span>
                      </button>
                    )
                  })}
                </div>
            }
          </div>
        </div>
      ))}

      <button onClick={addGroup}
        className="w-full rounded-xl border border-dashed border-white/20 py-2.5 text-sm text-gray-400 hover:border-green-500/60 hover:text-white transition">
        + Neues Dropdown-Menü hinzufügen
      </button>

      {/* ── Feste Links (Intern, Noten etc.) ── */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-900/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-400">🔗 Feste Links</p>
            <p className="mt-0.5 text-xs text-gray-500">Eigenständige Links ohne Dropdown – z.&nbsp;B. „Intern" nur für angemeldete Mitglieder.</p>
          </div>
          <button onClick={addFixedLink} className="text-xs text-blue-400 hover:text-blue-300 transition whitespace-nowrap ml-4">+ Link</button>
        </div>
        {fixedLinks.map((link, li) => (
          <div key={li} className="rounded-lg border border-white/10 bg-slate-900/60 p-3 space-y-2">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-gray-400">Anzeigename</label>
                <input value={link.label} onChange={e => updateFixedLink(li, { label: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-gray-400">Pfad / URL</label>
                <div className="flex gap-1">
                  <input value={link.href} onChange={e => updateFixedLink(li, { href: e.target.value })} placeholder="/intern"
                    className="flex-1 rounded-lg border border-white/10 bg-slate-800 px-2 py-1.5 text-sm text-white font-mono focus:border-blue-500 focus:outline-none" />
                  <select
                    value={pages.find(p => `/${p.slug}` === link.href)?.slug ?? ''}
                    onChange={e => {
                      if (!e.target.value) return
                      const p = pages.find(pg => pg.slug === e.target.value)
                      if (p) updateFixedLink(li, { href: `/${p.slug}` })
                    }}
                    className="rounded-lg border border-white/10 bg-slate-800 px-2 py-1.5 text-xs text-gray-400 focus:border-blue-500 focus:outline-none max-w-[110px]">
                    <option value="">📄 Seite…</option>
                    {pages.map(p => <option key={p.slug} value={p.slug}>/{p.slug} – {p.title}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={() => removeFixedLink(li)} className="mb-0.5 text-xs text-red-400 hover:text-red-300 px-1">✕</button>
            </div>
            {/* Status Haupt-Link */}
            {(() => {
              const linkSlug = link.href.replace(/^\//, '')
              const linkedPage = linkSlug ? pages.find(p => p.slug === linkSlug) : null
              if (!linkSlug || link.href === '/') return null
              return linkedPage
                ? <p className="text-xs text-green-500/70">✓ CMS-Seite „{linkedPage.title}" verknüpft</p>
                : <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-yellow-500/60">⚠ Keine CMS-Seite für <span className="font-mono">{link.href}</span></p>
                    <button type="button" onClick={() => createPageForSlug(linkSlug, link.label)}
                      className="rounded bg-yellow-700/40 border border-yellow-500/30 px-2 py-0.5 text-xs text-yellow-300 hover:bg-yellow-600/50 transition whitespace-nowrap">
                      + Seite „{linkSlug}" anlegen
                    </button>
                  </div>
            })()}
            <VisibilitySelect value={link.visibility} onChange={v => updateFixedLink(li, { visibility: v })} />

            {/* Sub-Items */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-400">Untermenü-Links (optional)</label>
                <button
                  onClick={() => updateFixedLink(li, { items: [...(link.items ?? []), { label: 'Neuer Link', href: '/' }] })}
                  className="text-xs text-blue-400 hover:text-blue-300 transition">+ Sub-Link</button>
              </div>
              {(link.items ?? []).map((sub, si) => {
                const updateSub = (patch: Partial<{ label: string; href: string }>) =>
                  updateFixedLink(li, { items: (link.items ?? []).map((s, idx) => idx === si ? { ...s, ...patch } : s) })
                const subSlug = sub.href.replace(/^\//, '')
                const linkedPage = pages.find(p => p.slug === subSlug)
                return (
                  <div key={si} className="mt-2 rounded-lg border border-white/10 bg-slate-800/60 p-2 flex flex-col gap-1.5">
                    <div className="flex gap-2 items-center">
                      <input value={sub.label} onChange={e => updateSub({ label: e.target.value })}
                        placeholder="Label"
                        className="flex-1 rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none" />
                      <button onClick={() => updateFixedLink(li, { items: (link.items ?? []).filter((_, idx) => idx !== si) })}
                        className="text-xs text-red-400 hover:text-red-300 px-1 flex-shrink-0">✕</button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input value={sub.href} onChange={e => updateSub({ href: e.target.value })}
                        placeholder="/pfad"
                        className="flex-1 rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white font-mono focus:border-blue-500 focus:outline-none" />
                      {/* Seiten-Picker */}
                      <select
                        value={linkedPage ? subSlug : ''}
                        onChange={e => {
                          if (!e.target.value) return
                          const p = pages.find(pg => pg.slug === e.target.value)
                          if (p) updateSub({ href: `/${p.slug}`, label: sub.label || p.title })
                        }}
                        className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-gray-300 focus:border-blue-500 focus:outline-none max-w-[140px]">
                        <option value="">📄 Seite wählen…</option>
                        {pages.map(p => <option key={p.slug} value={p.slug}>/{p.slug}</option>)}
                      </select>
                    </div>
                    {/* Status: CMS-Seite gefunden oder nicht */}
                    {linkedPage
                      ? <p className="text-xs text-green-500/80">✓ CMS-Seite „{linkedPage.title}" verknüpft</p>
                      : sub.href && sub.href !== '/'
                        ? <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-yellow-500/70">⚠ Keine CMS-Seite für <span className="font-mono">{sub.href}</span></p>
                            <button
                              type="button"
                              onClick={() => createPageForSlug(subSlug, sub.label)}
                              className="rounded bg-yellow-700/40 border border-yellow-500/30 px-2 py-0.5 text-xs text-yellow-300 hover:bg-yellow-600/50 transition whitespace-nowrap">
                              + Seite „{subSlug}" anlegen
                            </button>
                          </div>
                        : null
                    }
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {fixedLinks.length === 0 && <p className="text-xs text-gray-600 italic">Keine festen Links konfiguriert</p>}
      </div>

      {/* Hidden pages */}
      <div className="rounded-xl border border-red-500/20 bg-red-900/10 p-4">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-red-400">🚫 Einzelseiten ausblenden</p>
        <p className="mb-3 text-xs text-gray-500">Seiten, die in keinem Dropdown sind, erscheinen als eigener Link. Hier kannst du einzelne ausblenden.</p>
        {(() => {
          const visiblePages = pages.filter(p => !inDropdown.has(p.slug))
          const orphanedHidden = Array.from(hiddenSet).filter(slug => !pages.find(p => p.slug === slug) && !inDropdown.has(slug))
          return visiblePages.length === 0 && orphanedHidden.length === 0
            ? <p className="text-xs text-gray-500 italic">Alle Seiten sind in Dropdowns vergeben.</p>
            : <div className="flex flex-col divide-y divide-white/5 rounded-lg border border-white/10 overflow-hidden">
                {/* Verwaiste Hidden-Slugs ohne passende Seite */}
                {orphanedHidden.map(slug => (
                  <button key={`orphan-hidden-${slug}`} type="button" onClick={() => toggleHidden(slug)}
                    className="flex items-center gap-3 px-3 py-2.5 text-left text-sm transition bg-yellow-900/20 text-yellow-400 hover:bg-yellow-900/40">
                    <span className="h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 bg-yellow-500 border-yellow-500">
                      <span className="text-white text-xs">✓</span>
                    </span>
                    <span className="font-mono text-xs text-yellow-600 w-28 truncate">/{slug}</span>
                    <span className="flex-1 truncate italic text-yellow-500/70">⚠ Seite nicht gefunden</span>
                    <span className="text-xs text-yellow-600/60">ausgeblendet – klicken zum Entfernen</span>
                  </button>
                ))}
                {visiblePages.map(p => {
                  const isHidden = hiddenSet.has(p.slug)
                  return (
                    <button key={p.slug} type="button" onClick={() => toggleHidden(p.slug)}
                      className={`flex items-center gap-3 px-3 py-2.5 text-left text-sm transition
                        ${isHidden ? 'bg-red-900/30 text-red-400' : 'bg-slate-900 text-gray-400 hover:bg-slate-800 hover:text-white'}`}>
                      <span className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0
                        ${isHidden ? 'bg-red-500 border-red-500' : 'border-white/20'}`}>
                        {isHidden && <span className="text-white text-xs">✓</span>}
                      </span>
                      <span className="font-mono text-xs text-gray-500 w-28 truncate">/{p.slug}</span>
                      <span className="flex-1 truncate">{p.title}</span>
                      {!isHidden && <span className="text-xs text-gray-500">→ eigenständiger Link</span>}
                      {isHidden && <span className="text-xs text-red-400/70">ausgeblendet</span>}
                    </button>
                  )
                })}
              </div>
        })()}
      </div>
    </div>
  )
}

// ─── Page Editor ──────────────────────────────────────────────────────────────
function PageEditor({ page, onBack }: { page: PageMeta; onBack: () => void }) {
  const [sections, setSections] = useState<SectionResponse[]>(page.sections.sort((a, b) => a.position - b.position))
  const [addType, setAddType] = useState('HERO')

  const reload = async () => {
    const res = await fetch(`${API_BASE}/api/pages/${page.slug}`)
    if (res.ok) { const p = await res.json(); setSections(p.sections.sort((a: SectionResponse, b: SectionResponse) => a.position - b.position)) }
  }

  const addSection = async () => {
    const defaultContent: Record<string, unknown> =
      addType === 'HERO' ? { headline: 'Neuer Titel', subheadline: 'Untertitel', ctaLabel: 'Mehr', ctaHref: '/', backgroundImage: '' }
      : addType === 'EVENT_CARD' ? { events: [{ title: 'Event', date: '01.01.2026', location: 'Ort', description: 'Beschreibung' }] }
      : addType === 'PERSON_GRID' ? { heading: 'Personen', persons: [] }
      : addType === 'NEXT_CONCERT' ? { events: [] }
      : addType === 'BAND_GRID' ? { heading: 'Band', persons: [] }
      : addType === 'CHOIR_LIST' ? { heading: 'Chor', conductor: '', voices: [] }
      : addType === 'IMAGE_CAPTION' ? { imageUrl: '', caption: '' }
      : addType === 'TERMINE_LIST' ? { heading: 'Termine', year: '2026', termine: [] }
      : addType === 'ACTIVITY_GRID' ? { heading: 'Ausflüge & Jugendfahrten', intro: '', items: [] }
      : addType === 'SPONSOR_GRID' ? { heading: 'Unsere Sponsoren', intro: '', sponsors: [] }
      : { heading: 'Überschrift', markdown: 'Inhalt hier...' }
    await fetch(`${API_BASE}/api/pages/${page.slug}/sections`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: addType, position: sections.length + 1, content: defaultContent }),
    })
    reload()
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button onClick={onBack} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition">← Zurück</button>
        <div>
          <h2 className="text-xl font-bold text-white">{page.title}</h2>
          <p className="text-xs text-gray-400 font-mono">/{page.slug}</p>
        </div>
      </div>
      <div className="flex flex-col gap-4 mb-6">
        {sections.length === 0 && <p className="text-sm text-gray-500">Keine Sektionen vorhanden.</p>}
        {sections.map(s => <SectionEditor key={s.id} section={s} pageSlug={page.slug} onSaved={reload} onDeleted={reload} />)}
      </div>
      <div className="flex gap-3 items-center border-t border-white/10 pt-5">
        <select value={addType} onChange={e => setAddType(e.target.value)}
          className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none">
          {['HERO', 'EVENT_CARD', 'TEXT_BLOCK', 'PERSON_GRID', 'NEXT_CONCERT', 'BAND_GRID', 'CHOIR_LIST', 'IMAGE_CAPTION', 'TERMINE_LIST', 'ACTIVITY_GRID', 'SPONSOR_GRID'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={addSection} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition">
          + Sektion hinzufügen
        </button>
      </div>
    </div>
  )
}

// ─── R2 Asset Browser ─────────────────────────────────────────────────────────
function AssetBrowser() {
  const [data, setData] = useState<AssetListResponse>({ folders: [], files: [], prefix: '' })
  const [prefix, setPrefix] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [renamingKey, setRenamingKey] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null)
  const [renameFolderValue, setRenameFolderValue] = useState('')
  // Multi-select + move
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [moving, setMoving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async (p: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/assets?prefix=${encodeURIComponent(p)}`, { credentials: 'include' })
      if (res.ok) setData(await res.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(prefix) }, [load, prefix])
  // Clear selection when navigating
  useEffect(() => { setSelectedKeys(new Set()) }, [prefix])

  const breadcrumbs = prefix.split('/').filter(Boolean)

  const goUp = () => {
    const parts = prefix.split('/').filter(Boolean); parts.pop()
    setPrefix(parts.length > 0 ? parts.join('/') + '/' : '')
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files || files.length === 0) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const folder = (prefix || 'images').replace(/\/$/, '')
      const form = new FormData(); form.append('file', file); form.append('folder', folder)
      await fetch(`${API_BASE}/api/admin/assets/upload`, { method: 'POST', credentials: 'include', body: form })
    }
    setUploading(false); if (fileRef.current) fileRef.current.value = ''; load(prefix)
  }

  const handleDelete = async (key: string) => {
    if (!confirm(`"${key.split('/').pop()}" wirklich löschen?`)) return
    await fetch(`${API_BASE}/api/admin/assets?key=${encodeURIComponent(key)}`, { method: 'DELETE', credentials: 'include' })
    setSelectedKeys(prev => { const n = new Set(prev); n.delete(key); return n })
    load(prefix)
  }

  const handleDeleteFolder = async (folderPrefix: string) => {
    const name = folderPrefix.replace(prefix, '').replace(/\/$/, '')
    if (!confirm(`Ordner "${name}" und alle darin enthaltenen Dateien wirklich löschen?`)) return
    await fetch(`${API_BASE}/api/admin/assets/folder?prefix=${encodeURIComponent(folderPrefix)}`, { method: 'DELETE', credentials: 'include' })
    load(prefix)
  }

  const handleCreateFolder = async () => {
    const name = newFolderName.trim().replace(/\//g, '')
    if (!name) return
    const key = (prefix ? prefix : '') + name
    await fetch(`${API_BASE}/api/admin/assets/folder`, { method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) })
    setNewFolderName(''); setShowNewFolder(false); load(prefix)
  }

  const startRenameFile = (key: string) => { setRenamingKey(key); setRenameValue(key.split('/').pop() ?? '') }

  const confirmRenameFile = async (oldKey: string) => {
    const newName = renameValue.trim()
    if (!newName || newName === oldKey.split('/').pop()) { setRenamingKey(null); return }
    const dir = oldKey.includes('/') ? oldKey.substring(0, oldKey.lastIndexOf('/') + 1) : ''
    const newKey = dir + newName
    await fetch(`${API_BASE}/api/admin/assets/rename`, { method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldKey, newKey }) })
    setRenamingKey(null); load(prefix)
  }

  const startRenameFolder = (folderPath: string) => {
    setRenamingFolder(folderPath)
    setRenameFolderValue(folderPath.replace(prefix, '').replace(/\/$/, ''))
  }

  const confirmRenameFolder = async (oldFolderPrefix: string) => {
    const newName = renameFolderValue.trim().replace(/\//g, '')
    const oldName = oldFolderPrefix.replace(prefix, '').replace(/\/$/, '')
    if (!newName || newName === oldName) { setRenamingFolder(null); return }
    const newFolderPrefix = prefix + newName + '/'
    const res = await fetch(`${API_BASE}/api/admin/assets?prefix=${encodeURIComponent(oldFolderPrefix)}`, { credentials: 'include' })
    if (!res.ok) { setRenamingFolder(null); return }
    const folderData = await res.json()
    const allFiles: AssetFile[] = folderData.files ?? []
    for (const f of allFiles) {
      const newKey = newFolderPrefix + f.key.substring(oldFolderPrefix.length)
      await fetch(`${API_BASE}/api/admin/assets/rename`, { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldKey: f.key, newKey }) })
    }
    await fetch(`${API_BASE}/api/admin/assets/folder?prefix=${encodeURIComponent(oldFolderPrefix)}`, { method: 'DELETE', credentials: 'include' })
    setRenamingFolder(null); load(prefix)
  }

  const handleMoveSelected = async (targetFolder: string) => {
    setMoving(true)
    setShowMoveModal(false)
    const targetPrefix = targetFolder ? targetFolder.replace(/\/$/, '') + '/' : ''
    for (const oldKey of selectedKeys) {
      const filename = oldKey.split('/').pop() ?? oldKey
      const newKey = targetPrefix + filename
      if (newKey !== oldKey) {
        await fetch(`${API_BASE}/api/admin/assets/rename`, { method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldKey, newKey }) })
      }
    }
    setSelectedKeys(new Set())
    setMoving(false)
    load(prefix)
  }

  const toggleSelect = (key: string) => {
    setSelectedKeys(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  const toggleAll = () => {
    if (selectedKeys.size === data.files.length) setSelectedKeys(new Set())
    else setSelectedKeys(new Set(data.files.map(f => f.key)))
  }

  const copyUrl = (url: string) => { navigator.clipboard.writeText(url); setCopied(url); setTimeout(() => setCopied(''), 1500) }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 flex-1 min-w-0 overflow-x-auto">
          <button onClick={() => setPrefix('')} className="text-sm text-green-400 hover:underline font-mono whitespace-nowrap">Root</button>
          {breadcrumbs.map((b, i) => {
            const p = breadcrumbs.slice(0, i + 1).join('/') + '/'
            return <React.Fragment key={p}>
              <span className="text-gray-500 mx-1">/</span>
              <button onClick={() => setPrefix(p)} className="text-sm text-green-400 hover:underline font-mono whitespace-nowrap">{b}</button>
            </React.Fragment>
          })}
        </div>
        {prefix && <button onClick={goUp} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-400 hover:text-white transition">⬆ Hoch</button>}
        {/* Neuer Ordner */}
        {showNewFolder ? (
          <div className="flex items-center gap-1">
            <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false) }}
              autoFocus placeholder="Ordnername"
              className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none w-36" />
            <button onClick={handleCreateFolder} className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-500 transition">✓</button>
            <button onClick={() => setShowNewFolder(false)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-400 hover:text-white transition">✕</button>
          </div>
        ) : (
          <button onClick={() => setShowNewFolder(true)}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 hover:border-green-500/50 hover:text-white transition">
            📁+ Ordner
          </button>
        )}
        <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">
          {uploading ? 'Lädt hoch…' : '↑ Hochladen'}
        </button>
      </div>

      {/* Auswahl-Aktionsleiste */}
      {selectedKeys.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-900/20 px-4 py-3">
          <span className="text-sm text-blue-300 font-semibold">{selectedKeys.size} Datei(en) ausgewählt</span>
          <button onClick={() => setShowMoveModal(true)} disabled={moving}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition">
            {moving ? 'Verschiebe…' : '📁 Verschieben nach…'}
          </button>
          <button onClick={() => setSelectedKeys(new Set())} className="ml-auto text-xs text-gray-500 hover:text-white transition">
            Auswahl aufheben
          </button>
        </div>
      )}

      {loading ? <p className="text-gray-400 text-sm">Lade Assets…</p> : (
        <>
          {/* Ordner */}
          {data.folders.length > 0 && (
            <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {data.folders.map(f => {
                const folderName = f.replace(prefix, '').replace(/\/$/, '')
                return (
                  <div key={f} className="group flex items-center gap-1 rounded-lg border border-white/10 bg-slate-800 hover:border-green-500/40 transition">
                    {renamingFolder === f ? (
                      <div className="flex items-center gap-1 px-2 py-1.5 w-full">
                        <input value={renameFolderValue} onChange={e => setRenameFolderValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') confirmRenameFolder(f); if (e.key === 'Escape') setRenamingFolder(null) }}
                          autoFocus className="flex-1 min-w-0 rounded bg-slate-700 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-green-500" />
                        <button onClick={() => confirmRenameFolder(f)} className="text-green-400 hover:text-green-300 text-xs">✓</button>
                        <button onClick={() => setRenamingFolder(null)} className="text-gray-500 hover:text-white text-xs">✕</button>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => setPrefix(f)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white flex-1 min-w-0">
                          📁 <span className="truncate font-mono">{folderName}</span>
                        </button>
                        <div className="hidden group-hover:flex items-center gap-1 pr-1">
                          <button onClick={() => startRenameFolder(f)} title="Umbenennen"
                            className="rounded p-1 text-gray-500 hover:text-yellow-400 transition text-xs">✏️</button>
                          <button onClick={() => handleDeleteFolder(f)} title="Löschen"
                            className="rounded p-1 text-gray-500 hover:text-red-400 transition text-xs">🗑</button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {data.files.length === 0 && data.folders.length === 0 && (
            <p className="text-gray-500 text-sm">Dieser Ordner ist leer. Lade Dateien hoch, um sie hier zu sehen.</p>
          )}
          {/* Dateien */}
          {data.files.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-gray-400">
                  <tr>
                    <th className="px-3 py-3 text-left w-8">
                      <input type="checkbox" checked={selectedKeys.size === data.files.length && data.files.length > 0}
                        onChange={toggleAll} className="rounded accent-green-500 cursor-pointer" />
                    </th>
                    <th className="px-4 py-3 text-left">Vorschau</th>
                    <th className="px-4 py-3 text-left">Name / Pfad</th>
                    <th className="px-4 py-3 text-left">Größe</th>
                    <th className="px-4 py-3 text-left">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.files.map(a => (
                    <tr key={a.key} onClick={() => toggleSelect(a.key)}
                      className={`transition cursor-pointer ${selectedKeys.has(a.key) ? 'bg-blue-900/20 hover:bg-blue-900/30' : 'bg-slate-900 hover:bg-slate-800'}`}>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedKeys.has(a.key)} onChange={() => toggleSelect(a.key)}
                          className="rounded accent-green-500 cursor-pointer" />
                      </td>
                      <td className="px-4 py-3">
                        {isImage(a.key)
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={a.url} alt={a.key} className="h-14 w-20 object-cover rounded-lg border border-white/10" />
                          : <span className="text-2xl">{a.key.endsWith('.pdf') ? '📄' : '📎'}</span>}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {renamingKey === a.key ? (
                          <div className="flex items-center gap-1">
                            <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') confirmRenameFile(a.key); if (e.key === 'Escape') setRenamingKey(null) }}
                              autoFocus className="rounded bg-slate-700 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-green-500 w-48" />
                            <button onClick={() => confirmRenameFile(a.key)} className="text-green-400 hover:text-green-300 text-xs">✓</button>
                            <button onClick={() => setRenamingKey(null)} className="text-gray-500 hover:text-white text-xs">✕</button>
                          </div>
                        ) : (
                          <>
                            <p className="text-gray-200 font-semibold text-xs">{a.key.split('/').pop()}</p>
                            <p className="text-gray-500 font-mono text-xs mt-0.5 break-all">{a.key}</p>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatBytes(a.size)}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => copyUrl(a.url)}
                            className="rounded px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-gray-300 transition whitespace-nowrap">
                            {copied === a.url ? '✓ Kopiert' : 'URL kopieren'}
                          </button>
                          <a href={a.url} target="_blank" rel="noopener noreferrer"
                            className="rounded px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-gray-300 transition">Öffnen ↗</a>
                          <button onClick={() => startRenameFile(a.key)}
                            className="rounded px-2 py-1 text-xs bg-yellow-900/40 hover:bg-yellow-900/70 text-yellow-400 transition">Umbenennen</button>
                          <button onClick={() => handleDelete(a.key)}
                            className="rounded px-2 py-1 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 transition">Löschen</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Move-Modal */}
      {showMoveModal && (
        <MoveFolderPickerModal
          count={selectedKeys.size}
          onSelect={handleMoveSelected}
          onClose={() => setShowMoveModal(false)}
        />
      )}
    </div>
  )
}

// ─── Move Folder Picker ────────────────────────────────────────────────────────
function MoveFolderPickerModal({ count, onSelect, onClose }: {
  count: number; onSelect: (folder: string) => void; onClose: () => void
}) {
  const [prefix, setPrefix] = useState('')
  const [folders, setFolders] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (p: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/assets?prefix=${encodeURIComponent(p)}`, { credentials: 'include' })
      if (res.ok) { const d = await res.json(); setFolders(d.folders) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(prefix) }, [load, prefix])

  const breadcrumbs = prefix.split('/').filter(Boolean)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="font-bold text-white">📁 {count} Datei(en) verschieben nach…</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">✕</button>
        </div>
        <div className="flex items-center gap-1 px-5 py-3 border-b border-white/10 flex-wrap">
          <button onClick={() => setPrefix('')} className="text-xs text-green-400 hover:underline">Root</button>
          {breadcrumbs.map((b, i) => {
            const p = breadcrumbs.slice(0, i + 1).join('/') + '/'
            return <React.Fragment key={p}>
              <span className="text-gray-500 mx-1">/</span>
              <button onClick={() => setPrefix(p)} className="text-xs text-green-400 hover:underline">{b}</button>
            </React.Fragment>
          })}
        </div>
        <div className="overflow-y-auto p-4 flex flex-col gap-2">
          <button onClick={() => onSelect(prefix)}
            className="flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-900/20 px-4 py-2.5 text-sm text-green-400 hover:bg-green-900/40 transition">
            ✓ Hierher verschieben: <span className="font-mono">{prefix || 'Root'}</span>
          </button>
          {loading ? <p className="text-sm text-gray-400 py-2">Lade…</p> : folders.length === 0
            ? <p className="text-sm text-gray-500 py-2">Keine Unterordner vorhanden.</p>
            : folders.map(f => (
              <button key={f} onClick={() => setPrefix(f)}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-800 px-4 py-2.5 text-sm text-gray-300 hover:border-green-500/40 hover:text-white transition">
                📁 <span className="font-mono">{f.replace(prefix, '').replace(/\/$/, '')}</span>
              </button>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ─── R2 Folder Picker (inline, for settings) ──────────────────────────────────
// ─── R2 Folder Picker (inline, for settings) ──────────────────────────────────
function R2FolderPickerModal({ onSelect, onClose }: { onSelect: (prefix: string) => void; onClose: () => void }) {
  const [prefix, setPrefix] = useState('')
  const [folders, setFolders] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (p: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/assets?prefix=${encodeURIComponent(p)}`, { credentials: 'include' })
      if (res.ok) { const d = await res.json(); setFolders(d.folders) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(prefix) }, [load, prefix])

  const breadcrumbs = prefix.split('/').filter(Boolean)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="font-bold text-white">📁 R2-Ordner wählen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">✕</button>
        </div>
        <div className="flex items-center gap-1 px-5 py-3 border-b border-white/10 flex-wrap">
          <button onClick={() => setPrefix('')} className="text-xs text-green-400 hover:underline">Root</button>
          {breadcrumbs.map((b, i) => {
            const p = breadcrumbs.slice(0, i + 1).join('/') + '/'
            return <React.Fragment key={p}>
              <span className="text-gray-500 mx-1">/</span>
              <button onClick={() => setPrefix(p)} className="text-xs text-green-400 hover:underline">{b}</button>
            </React.Fragment>
          })}
        </div>
        <div className="overflow-y-auto p-4 flex flex-col gap-2">
          <button onClick={() => { onSelect(prefix); onClose() }}
            className="flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-900/20 px-4 py-2.5 text-sm text-green-400 hover:bg-green-900/40 transition">
            ✓ Diesen Ordner wählen: <span className="font-mono">{prefix || 'Root'}</span>
          </button>
          {loading ? <p className="text-sm text-gray-400 py-2">Lade…</p> : folders.length === 0
            ? <p className="text-sm text-gray-500 py-2">Keine Unterordner vorhanden.</p>
            : folders.map(f => (
              <button key={f} onClick={() => setPrefix(f)}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-800 px-4 py-2.5 text-sm text-gray-300 hover:border-green-500/40 hover:text-white transition">
                📁 <span className="font-mono">{f.replace(prefix, '').replace(/\/$/, '')}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}

// ─── Site Settings Editor ─────────────────────────────────────────────────────
function SiteSettingsEditor() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [allPages, setAllPages] = useState<{ slug: string; title: string }[]>([])

  const reloadPages = () =>
    fetch(`${API_BASE}/api/pages`)
      .then(r => r.json())
      .then((data: unknown) => setAllPages(Array.isArray(data) ? data : []))
      .catch(() => {})

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/settings`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setSettings(data); setLoading(false) })
      .catch(() => setLoading(false))
    reloadPages()
  }, [])

  const saveSettings = async () => {
    setSaving(true)
    await fetch(`${API_BASE}/api/admin/settings`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <p className="text-gray-400 text-sm">Lade Einstellungen…</p>

  return (
    <div className="max-w-2xl space-y-6">
      {showFolderPicker && (
        <R2FolderPickerModal
          onSelect={v => setSettings({ ...settings, noten_prefix: v })}
          onClose={() => setShowFolderPicker(false)}
        />
      )}

      {/* Logo */}
      <div className="rounded-xl border border-white/10 bg-slate-800/40 p-6">
        <h3 className="mb-4 text-base font-bold text-white">🖼 Website-Darstellung</h3>
        <div className="space-y-4">
          <ImageField
            label="Logo (Navbar)"
            value={settings.logo_url || ''}
            onChange={(v) => setSettings({ ...settings, logo_url: v })}
          />
        </div>
      </div>

      {/* Noten */}
      <div className="rounded-xl border border-white/10 bg-slate-800/40 p-6">
        <h3 className="mb-1 text-base font-bold text-white">🎼 Noten-Einstellungen</h3>
        <p className="mb-4 text-sm text-gray-400">Der R2-Ordner, aus dem die Noten-Seite für alle Mitglieder lädt.</p>
        <div>
          <label className="mb-1 block text-xs text-gray-400">Noten-Ordner (R2-Präfix)</label>
          <div className="flex gap-2 items-center">
            <input
              value={settings.noten_prefix || ''}
              onChange={e => setSettings({ ...settings, noten_prefix: e.target.value })}
              placeholder="z.B. Noten/"
              className="flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white font-mono focus:border-green-500 focus:outline-none"
            />
            <button onClick={() => setShowFolderPicker(true)}
              className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-slate-600 transition whitespace-nowrap">
              📁 R2 wählen
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Aktuell: <span className="font-mono text-green-400">{settings.noten_prefix || '(nicht gesetzt – Root)'}</span>
          </p>
        </div>
      </div>

      {/* Navigation */}
      <NavConfigEditor settings={settings} setSettings={setSettings} allPages={allPages} reloadPages={reloadPages} />

      <button onClick={saveSettings} disabled={saving}
        className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">
        {saving ? 'Speichert…' : saved ? '✓ Gespeichert!' : '✓ Einstellungen speichern'}
      </button>
    </div>
  )
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<'pages' | 'assets' | 'settings' | 'members'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin_tab')
      if (saved === 'assets' || saved === 'settings' || saved === 'members') return saved as any
    }
    return 'pages'
  })
  // For BOARD users, default to members tab (set after user loads)
  const [boardTabInit, setBoardTabInit] = useState(false)
  // Einladung
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRolle, setInviteRolle] = useState('MEMBER')
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [inviteTokenCopied, setInviteTokenCopied] = useState(false)
  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteToken(null)
    const res = await fetch(`${API_BASE}/api/invitation/invite`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, rolle: inviteRolle }),
    })
    const data = await res.json()
    setInviteMsg(data.message || data.error || 'Fehler')
    if (res.ok) {
      setInviteEmail('')
      if (data.token) setInviteToken(data.token)
    }
    setTimeout(() => setInviteMsg(''), 6000)
  }
  const copyInviteToken = () => {
    if (!inviteToken) return
    const url = `${window.location.origin}/register?token=${inviteToken}`
    navigator.clipboard.writeText(url).then(() => {
      setInviteTokenCopied(true)
      setTimeout(() => setInviteTokenCopied(false), 2000)
    })
  }
  const [pages, setPages] = useState<PageMeta[]>([])
  const [selectedPage, setSelectedPage] = useState<PageMeta | null>(null)
  const [newSlug, setNewSlug] = useState(''); const [newTitle, setNewTitle] = useState('')
  const [editingPage, setEditingPage] = useState<{ id: string; slug: string; originalSlug: string; title: string } | null>(null)
  const [pageActionError, setPageActionError] = useState<string | null>(null)

  // Gruppen & Locations
  interface Gruppe { id: string; wochentag: string; vonUhrzeit: string; bisUhrzeit: string; location?: { id: string; name: string; adresse: string } }
  interface Loc { id: string; name: string; adresse: string }
  const [gruppen, setGruppen] = useState<Gruppe[]>([])
  const [locations, setLocations] = useState<Loc[]>([])
  const [gruppenMsg, setGruppenMsg] = useState('')
  const [newGruppe, setNewGruppe] = useState({ locationId: '', vonUhrzeit: '', bisUhrzeit: '', wochentag: '' })
  const [newLocation, setNewLocation] = useState({ name: '', adresse: '' })

  const loadGruppen = useCallback(async () => {
    const [gr, lo] = await Promise.all([
      fetch(`${API_BASE}/api/gruppen`, { credentials: 'include' }),
      fetch(`${API_BASE}/api/locations`, { credentials: 'include' }),
    ])
    if (gr.ok) setGruppen(await gr.json())
    if (lo.ok) setLocations(await lo.json())
  }, [])

  useEffect(() => { if (tab === 'members') loadGruppen() }, [tab, loadGruppen])

  const createGruppe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGruppe.locationId || !newGruppe.vonUhrzeit || !newGruppe.bisUhrzeit || !newGruppe.wochentag) return
    const res = await fetch(`${API_BASE}/api/gruppen`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newGruppe),
    })
    if (res.ok) { setNewGruppe({ locationId: '', vonUhrzeit: '', bisUhrzeit: '', wochentag: '' }); loadGruppen() }
    else { const d = await res.json().catch(() => ({})); setGruppenMsg(d.error ?? 'Fehler beim Erstellen') }
  }

  const deleteGruppe = async (id: string) => {
    if (!confirm('Gruppe wirklich löschen?')) return
    await fetch(`${API_BASE}/api/gruppen/${id}`, { method: 'DELETE', credentials: 'include' })
    loadGruppen()
  }

  const createLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLocation.name) return
    const res = await fetch(`${API_BASE}/api/locations`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLocation),
    })
    if (res.ok) { setNewLocation({ name: '', adresse: '' }); loadGruppen() }
  }

  const deleteLocation = async (id: string) => {
    if (!confirm('Location wirklich löschen?')) return
    await fetch(`${API_BASE}/api/locations/${id}`, { method: 'DELETE', credentials: 'include' })
    loadGruppen()
  }

  const switchTab = (t: 'pages' | 'assets' | 'settings' | 'members') => {
    setTab(t); setSelectedPage(null)
    if (typeof window !== 'undefined') localStorage.setItem('admin_tab', t)
  }

  useEffect(() => { if (!loading && (!user || !isBoard(user))) router.push('/') }, [user, loading, router])

  // Redirect board users to members tab by default
  useEffect(() => {
    if (!loading && user && !isAdmin(user) && isBoard(user) && !boardTabInit) {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('admin_tab') : null
      if (!saved || saved === 'pages' || saved === 'assets' || saved === 'settings') {
        setTab('members')
      }
      setBoardTabInit(true)
    }
  }, [user, loading, boardTabInit])

  const loadPages = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/pages`)
    if (res.ok) setPages(await res.json())
  }, [])

  useEffect(() => { if (tab === 'pages') loadPages() }, [tab, loadPages])

  const createPage = async () => {
    if (!newSlug.trim() || !newTitle.trim()) return
    await fetch(`${API_BASE}/api/pages`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: newSlug.trim(), title: newTitle.trim() }),
    })
    setNewSlug(''); setNewTitle(''); loadPages()
  }

  const deletePage = async (slug: string | undefined) => {
    if (!slug) { setPageActionError('Seite hat keinen Slug – Löschen nicht möglich.'); return }
    if (!confirm(`Seite "${slug}" wirklich löschen?`)) return
    setPageActionError(null)
    const res = await fetch(`${API_BASE}/api/pages/${slug}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) { setPageActionError(`Löschen fehlgeschlagen (${res.status})`); return }
    loadPages()
  }

  const savePage = async () => {
    if (!editingPage) return
    setPageActionError(null)
    // originalSlug als URL-Pfad verwenden, damit Slug-Änderungen funktionieren
    const res = await fetch(`${API_BASE}/api/pages/${editingPage.originalSlug}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: editingPage.slug.trim(), title: editingPage.title.trim() }),
    })
    if (res.ok) { setEditingPage(null); loadPages() }
    else { setPageActionError(`Speichern fehlgeschlagen (${res.status})`) }
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-gray-400">Laden…</div>
  if (!user || !isBoard(user)) return null

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-1 text-3xl font-bold text-white">{isAdmin(user) ? 'Admin-Dashboard' : 'Vorstand-Dashboard'}</h1>
      <p className="mb-8 text-gray-400 text-sm">{isAdmin(user) ? 'Verwaltung von Seiten, Sektionen und Assets' : 'Mitgliederverwaltung und Einladungen'}</p>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-white/10 flex-wrap">
        {isAdmin(user) && (['pages', 'assets', 'settings'] as const).map(t => (
          <button key={t} onClick={() => switchTab(t)}
            className={`px-4 py-2 text-sm font-semibold transition border-b-2 ${tab === t ? 'border-green-500 text-green-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
            {t === 'pages' ? '📄 Seiten' : t === 'assets' ? '🗂 R2 Assets' : '⚙️ Einstellungen'}
          </button>
        ))}
        <button onClick={() => switchTab('members')}
          className={`px-4 py-2 text-sm font-semibold transition border-b-2 ${tab === 'members' ? 'border-green-500 text-green-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
          👥 Mitglieder
        </button>
      </div>

      {tab === 'assets' && <AssetBrowser />}

      {tab === 'settings' && <SiteSettingsEditor />}

      {tab === 'members' && (
        <div className="space-y-6">
          {/* Link zur Mitgliederverwaltung */}
          <div className="rounded-xl border border-white/10 bg-slate-900 p-6">
            <h2 className="mb-2 text-lg font-semibold text-white">Mitgliederverwaltung</h2>
            <p className="mb-4 text-sm text-gray-400">Mitglieder suchen, deaktivieren, Gruppen zuweisen und Änderungshistorie einsehen.</p>
            <a href="/admin/members"
              className="inline-block rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition">
              Zur Mitgliederverwaltung →
            </a>
          </div>
          {/* Einladungsformular */}
          <div className="rounded-xl border border-white/10 bg-slate-900 p-6">
            <h2 className="mb-2 text-lg font-semibold text-white">Mitglied einladen</h2>
            <p className="mb-4 text-sm text-gray-400">Sendet einen Einladungslink per E-Mail. BOARD kann nur MEMBER und BOARD einladen.</p>
            {inviteMsg && <div className={`mb-3 rounded-lg px-4 py-2 text-sm ${inviteMsg.includes('verschickt') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>{inviteMsg}</div>}
            <form onSubmit={sendInvite} className="flex flex-wrap gap-3">
              <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="E-Mail-Adresse"
                className="flex-1 min-w-[200px] rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none" />
              <select value={inviteRolle} onChange={e => setInviteRolle(e.target.value)}
                className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none">
                <option value="MEMBER">Mitglied</option>
                <option value="BOARD">Vorstand</option>
                {user.role === 'ROLE_ADMIN' && <option value="ADMIN">Administrator</option>}
              </select>
              <button type="submit"
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition">
                Einladung senden
              </button>
            </form>
            {inviteToken && (
              <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-900/10 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-yellow-400">📋 Einladungslink (Kopier-Fallback, falls Mail nicht ankam)</p>
                  <button type="button" onClick={copyInviteToken}
                    className="rounded-lg border border-yellow-500/30 bg-yellow-900/20 px-3 py-1 text-xs font-medium text-yellow-300 hover:bg-yellow-800/30 transition">
                    {inviteTokenCopied ? '✓ Kopiert!' : 'Link kopieren'}
                  </button>
                </div>
                <code className="block break-all rounded-lg bg-slate-950/60 p-3 text-xs text-gray-300 font-mono select-all">
                  {`${typeof window !== 'undefined' ? window.location.origin : ''}/register?token=${inviteToken}`}
                </code>
                <p className="mt-2 text-xs text-gray-500">Diesen Link manuell an das Mitglied weitergeben, falls die E-Mail nicht ankam.</p>
              </div>
            )}
          </div>

          {/* Gitarrengruppen */}
          <div className="rounded-xl border border-white/10 bg-slate-900 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">🎸 Gitarrengruppen verwalten</h2>
            {gruppenMsg && <p className="mb-3 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-400">{gruppenMsg}</p>}

            {/* Bestehende Gruppen */}
            {gruppen.length > 0 && (
              <div className="mb-4 overflow-hidden rounded-lg border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800 text-gray-400">
                    <tr>
                      <th className="px-3 py-2 text-left">Wochentag</th>
                      <th className="px-3 py-2 text-left">Zeit</th>
                      <th className="px-3 py-2 text-left">Location</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {gruppen.map(g => (
                      <tr key={g.id} className="bg-slate-900">
                        <td className="px-3 py-2 text-white">{g.wochentag}</td>
                        <td className="px-3 py-2 text-gray-300">{g.vonUhrzeit} – {g.bisUhrzeit} Uhr</td>
                        <td className="px-3 py-2 text-gray-300">{g.location?.name ?? '–'}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => deleteGruppe(g.id)}
                            className="rounded px-2 py-1 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 transition">
                            Löschen
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {gruppen.length === 0 && <p className="mb-4 text-sm text-gray-500">Noch keine Gruppen angelegt.</p>}

            {/* Neue Gruppe */}
            <form onSubmit={createGruppe} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="mb-1 block text-xs text-gray-400">Wochentag</label>
                <select value={newGruppe.wochentag} onChange={e => setNewGruppe(p => ({ ...p, wochentag: e.target.value }))}
                  className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none">
                  <option value="">– wählen –</option>
                  {['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Von</label>
                <input type="time" value={newGruppe.vonUhrzeit} onChange={e => setNewGruppe(p => ({ ...p, vonUhrzeit: e.target.value }))}
                  className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Bis</label>
                <input type="time" value={newGruppe.bisUhrzeit} onChange={e => setNewGruppe(p => ({ ...p, bisUhrzeit: e.target.value }))}
                  className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Location</label>
                <select value={newGruppe.locationId} onChange={e => setNewGruppe(p => ({ ...p, locationId: e.target.value }))}
                  className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none">
                  <option value="">– wählen –</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <button type="submit"
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition">
                + Gruppe anlegen
              </button>
            </form>
          </div>

          {/* Locations */}
          <div className="rounded-xl border border-white/10 bg-slate-900 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">📍 Locations verwalten</h2>

            {locations.length > 0 && (
              <div className="mb-4 overflow-hidden rounded-lg border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800 text-gray-400">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Adresse</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {locations.map(l => (
                      <tr key={l.id} className="bg-slate-900">
                        <td className="px-3 py-2 text-white">{l.name}</td>
                        <td className="px-3 py-2 text-gray-300">{l.adresse || '–'}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => deleteLocation(l.id)}
                            className="rounded px-2 py-1 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 transition">
                            Löschen
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {locations.length === 0 && <p className="mb-4 text-sm text-gray-500">Noch keine Locations angelegt.</p>}

            <form onSubmit={createLocation} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="mb-1 block text-xs text-gray-400">Name *</label>
                <input value={newLocation.name} onChange={e => setNewLocation(p => ({ ...p, name: e.target.value }))}
                  placeholder="z.B. Gemeindehaus" required
                  className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Adresse (optional)</label>
                <input value={newLocation.adresse} onChange={e => setNewLocation(p => ({ ...p, adresse: e.target.value }))}
                  placeholder="Musterstr. 1, 12345 Ort"
                  className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
              </div>
              <button type="submit"
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition">
                + Location anlegen
              </button>
            </form>
          </div>

        </div>
      )}

      {tab === 'pages' && (
        selectedPage ? (
          <PageEditor page={selectedPage} onBack={() => { setSelectedPage(null); loadPages() }} />
        ) : (
          <div>
            {pageActionError && (
              <div className="mb-4 rounded-xl border border-red-500/40 bg-red-900/20 px-4 py-3 text-sm text-red-400">
                ⚠ {pageActionError}
              </div>
            )}
            <div className="overflow-hidden rounded-xl border border-white/10 mb-6">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Slug</th>
                    <th className="px-4 py-3 text-left">Titel</th>
                    <th className="px-4 py-3 text-left">Sektionen</th>
                    <th className="px-4 py-3 text-left">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pages.map(p => (
                    <tr key={p.id} className="bg-slate-900 hover:bg-slate-800 transition">
                      {editingPage?.id === p.id ? (
                        <>
                          <td className="px-4 py-2">
                            <input value={editingPage.slug}
                              onChange={e => setEditingPage({ ...editingPage, slug: e.target.value })}
                              className="w-full rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs font-mono text-white focus:border-green-500 focus:outline-none" />
                          </td>
                          <td className="px-4 py-2">
                            <input value={editingPage.title}
                              onChange={e => setEditingPage({ ...editingPage, title: e.target.value })}
                              className="w-full rounded border border-white/10 bg-slate-800 px-2 py-1 text-sm text-white focus:border-green-500 focus:outline-none" />
                          </td>
                          <td className="px-4 py-3 text-gray-400">{p.sections?.length ?? 0}</td>
                          <td className="px-4 py-2">
                            <div className="flex gap-2">
                              <button onClick={savePage}
                                className="rounded px-2 py-1 text-xs bg-green-700/60 hover:bg-green-600 text-green-300 transition">✓ Speichern</button>
                              <button onClick={() => setEditingPage(null)}
                                className="rounded px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-gray-400 transition">Abbrechen</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-mono text-xs text-gray-300">
                            {p.slug ? `/${p.slug}` : <span className="text-yellow-500 italic">⚠ kein Slug</span>}
                          </td>
                          <td className="px-4 py-3 text-white">{p.title}</td>
                          <td className="px-4 py-3 text-gray-400">{p.sections?.length ?? 0}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 flex-wrap">
                              <button onClick={() => setEditingPage({ id: p.id, slug: p.slug ?? '', originalSlug: p.slug ?? '', title: p.title })}
                                className="rounded px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-gray-300 transition">✏️ Umbenennen</button>
                              <button onClick={() => setSelectedPage(p)}
                                className="rounded px-2 py-1 text-xs bg-green-800/40 hover:bg-green-700/60 text-green-400 transition">📝 Inhalt</button>
                              {p.slug && <a href={`/${p.slug}`} target="_blank" rel="noopener noreferrer"
                                className="rounded px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-gray-300 transition">Anzeigen →</a>}
                              <button onClick={() => deletePage(p.slug)}
                                className="rounded px-2 py-1 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 transition">Löschen</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-800/40 p-5">
              <h3 className="mb-3 font-semibold text-white">+ Neue Seite anlegen</h3>
              <div className="flex gap-3 flex-wrap">
                <input value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="slug (z.B. ueber-uns)"
                  className="flex-1 min-w-40 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none" />
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Titel"
                  className="flex-1 min-w-40 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none" />
                <button onClick={createPage} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition">Erstellen</button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  )
}

