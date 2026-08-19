'use client'
import { getApiBase } from '@/lib/api'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth, isAdmin, isBoard, isChef } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import KalenderTab from './components/KalenderTab'
import { AdminDocsPanel } from './components/AdminDocsPanel'
import { ConfirmDialog } from './components/ui/ConfirmDialog'
import { useToast } from './components/ui/Toast'
import { HelpHint } from './components/ui/HelpHint'
import { PreviewErrorBoundary } from './components/ui/PreviewErrorBoundary'
import SectionResolver from '@/components/SectionResolver'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const API_BASE = getApiBase()

interface AssetFile { key: string; size: number; lastModified: string; url: string }
interface AssetListResponse { folders: string[]; files: AssetFile[]; prefix: string }
interface SectionResponse { id: string; type: string; position: number; content: Record<string, unknown> }
interface PageMeta { id: string; slug: string; title: string; published?: boolean; sections: SectionResponse[] }

// ─── Section-Typen: verständliche Namen statt technischer Codes ────────────────
// Reihenfolge bestimmt auch die Sortierung im "Sektion hinzufügen"-Dropdown.
const SECTION_TYPE_INFO: Record<string, { label: string; icon: string; hint: string }> = {
  HERO:              { label: 'Hero-Banner',              icon: '🖼️', hint: 'Großes Titelbild mit Überschrift & Button - meist ganz oben auf einer Seite' },
  EVENT_CARD:        { label: 'Event-Karten',              icon: '🎫', hint: 'Manuell gepflegte Liste einzelner Veranstaltungen (unabhängig von der Terminverwaltung)' },
  TEXT_BLOCK:        { label: 'Textblock',                 icon: '📝', hint: 'Freier Fließtext mit optionaler Überschrift (unterstützt einfache Markdown-Formatierung)' },
  PERSON_GRID:       { label: 'Personen-Übersicht',        icon: '👤', hint: 'Kachel-Raster mit Personen, Foto, Rolle(n) und kurzer Biografie' },
  NEXT_CONCERT:      { label: 'Nächstes Konzert',          icon: '🎵', hint: 'Zeigt automatisch nur den nächsten anstehenden Termin aus deiner Liste an' },
  BAND_GRID:         { label: 'Band-Mitglieder',           icon: '🎸', hint: 'Wie "Personen-Übersicht", aber als eigener Bereich für die Band-Besetzung' },
  CHOIR_LIST:        { label: 'Chor-Liste',                icon: '🎶', hint: 'Chorleitung & Stimmgruppen mit Mitgliederliste' },
  IMAGE_CAPTION:     { label: 'Einzelbild',                 icon: '🖼️', hint: 'Ein großes Bild mit Bildunterschrift - für Bild+Text nebeneinander siehe "Bild & Text"' },
  TERMINE_LIST:      { label: 'Terminliste',                icon: '📅', hint: 'Vollständige Terminverwaltung mit Kategorien, Details und Archiv - wie die eigenständige Termine-Seite' },
  ACTIVITY_GRID:     { label: 'Aktivitäten & Ausflüge',    icon: '🚌', hint: 'Kachel-Raster für Ausflüge/Jugendfahrten' },
  SPONSOR_GRID:      { label: 'Sponsoren',                  icon: '🤝', hint: 'Logo-Raster der Sponsoren mit Kontaktdaten' },
  TERMINE_KONZERTE:  { label: 'Konzerttermine',             icon: '🎪', hint: 'Automatische, kompakte Liste ALLER kommenden Konzerte - kein manuelles Pflegen nötig' },
  INTERN_CHANGELOG:  { label: 'Änderungsprotokoll',         icon: '🆕', hint: 'Was ist neu? Nur für angemeldete Mitglieder im internen Bereich sichtbar' },
  IMAGE_TEXT:        { label: 'Bild & Text',                icon: '🖇️', hint: 'Bild und Fließtext nebeneinander, wahlweise Bild links oder rechts' },
  CTA_BUTTON:        { label: 'Aufruf-Button',              icon: '🔘', hint: 'Eigenständiger, auffälliger Button mit optionaler Überschrift/Text - z.B. "Jetzt anmelden"' },
  FAQ:               { label: 'Häufige Fragen',             icon: '❓', hint: 'Aufklappbare Liste aus Frage und Antwort' },
  SPACER:            { label: 'Abstand/Trenner',            icon: '➖', hint: 'Reiner Zwischenraum zur optischen Gliederung, optional mit dünner Trennlinie' },
  QUOTE:             { label: 'Zitat',                      icon: '💬', hint: 'Groß hervorgehobenes Zitat mit optionalem Namen/Rolle' },
  STATS:             { label: 'Zahlen & Fakten',            icon: '📊', hint: 'Große Kennzahlen nebeneinander, z.B. "seit 1975" oder "120+ Mitglieder"' },
  VIDEO_EMBED:       { label: 'Video',                      icon: '🎬', hint: 'YouTube- oder Vimeo-Video direkt in die Seite eingebettet' },
}
function sectionTypeInfo(type: string) {
  return SECTION_TYPE_INFO[type] ?? { label: type, icon: '📦', hint: 'Unbekannter Sektionstyp' }
}

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

// ─── Section Form Fields ───────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:border-green-500 focus:outline-none" />
    </div>
  )
}

function SectionHeader({ icon, title, desc }: { icon: string; title: string; desc?: string }) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-white/8">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-xl shrink-0">{icon}</div>
      <div>
        <h2 className="text-base font-bold text-white leading-none">{title}</h2>
        {desc && <p className="mt-0.5 text-xs text-gray-500">{desc}</p>}
      </div>
    </div>
  )
}

const POSITION_GRID = [
  ['left top',    'center top',    'right top'   ],
  ['left center', 'center',        'right center'],
  ['left bottom', 'center bottom', 'right bottom'],
] as const
const POSITION_LABELS: Record<string, string> = {
  'left top': '↖', 'center top': '↑', 'right top': '↗',
  'left center': '←', 'center': '·', 'right center': '→',
  'left bottom': '↙', 'center bottom': '↓', 'right bottom': '↘',
}

function HeroForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...content, [key]: val })
  const overlayOpacity = typeof content.overlayOpacity === 'number' ? content.overlayOpacity : 0.55
  const imageZoom      = typeof content.imageZoom === 'number' ? content.imageZoom : 1.0
  const imagePosition  = (content.imagePosition as string) ?? 'center'
  const parallax       = content.parallax !== false

  const zoomLabel = imageZoom <= 1.0 ? 'Standard' : imageZoom <= 1.3 ? 'Näher' : imageZoom <= 1.6 ? 'Nah' : 'Sehr nah'

  return (
    <div className="flex flex-col gap-3">
      <Field label="Hauptüberschrift" value={String(content.headline ?? '')} onChange={v => set('headline', v)} />
      <Field label="Unterüberschrift" value={String(content.subheadline ?? '')} onChange={v => set('subheadline', v)} />
      <Field label="Button-Text (CTA)" value={String(content.ctaLabel ?? '')} onChange={v => set('ctaLabel', v)} />
      <Field label="Button-Link (CTA)" value={String(content.ctaHref ?? '')} onChange={v => set('ctaHref', v)} />
      <ImageField label="Hintergrundbild" value={String(content.backgroundImage ?? content.imageUrl ?? '')} onChange={v => set('backgroundImage', v)} />

      {/* Parallax */}
      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={parallax}
          onChange={e => set('parallax', e.target.checked)}
          className="h-4 w-4 accent-green-500 rounded"
        />
        <span className="text-sm text-gray-300">Parallax-Scrolleffekt</span>
        <span className="text-xs text-gray-500">(Bild bewegt sich langsamer als der Inhalt)</span>
      </label>

      {/* Zoom */}
      <div>
        <label className="mb-1 block text-xs text-gray-400">
          Zoom: <span className="text-white font-semibold">{zoomLabel}</span>
          <span className="ml-2 text-gray-500">({imageZoom.toFixed(1)}×)</span>
        </label>
        <input
          type="range" min={1.0} max={2.0} step={0.1}
          value={imageZoom}
          onChange={e => set('imageZoom', parseFloat(e.target.value))}
          className="w-full accent-green-500"
        />
        <div className="flex justify-between text-xs text-gray-600 mt-0.5">
          <span>Standard</span>
          <span>Sehr nah</span>
        </div>
      </div>

      {/* Fokuspunkt */}
      <div>
        <label className="mb-1.5 block text-xs text-gray-400">Fokuspunkt</label>
        <div className="inline-grid grid-cols-3 gap-1">
          {POSITION_GRID.flat().map(pos => (
            <button
              key={pos} type="button"
              onClick={() => set('imagePosition', pos)}
              title={pos}
              className={`h-9 w-9 rounded-lg border text-base transition ${
                imagePosition === pos
                  ? 'border-green-500 bg-green-500/20 text-green-400'
                  : 'border-white/10 bg-slate-800 text-gray-400 hover:border-white/20 hover:text-white'
              }`}
            >{POSITION_LABELS[pos]}</button>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-600">Aktuell: <span className="text-gray-400">{imagePosition}</span></p>
      </div>

      {/* Abdunkelung */}
      <div>
        <label className="mb-1 block text-xs text-gray-400">
          Bild-Abdunkelung: <span className="text-white font-semibold">{Math.round(overlayOpacity * 100)} %</span>
          <span className="ml-2 text-gray-500">(0 % = kein Overlay, 100 % = komplett schwarz)</span>
        </label>
        <input
          type="range" min={0} max={1} step={0.05}
          value={overlayOpacity}
          onChange={e => set('overlayOpacity', parseFloat(e.target.value))}
          className="w-full accent-green-500"
        />
        <div className="flex justify-between text-xs text-gray-600 mt-0.5">
          <span>hell (0 %)</span>
          <span>dunkel (100 %)</span>
        </div>
      </div>
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
      <p className="text-xs text-gray-500">
        Willst du ein Bild neben dem Text? Nutze stattdessen den Baustein "Bild &amp; Text".
      </p>
    </div>
  )
}

interface EventItem { title: string; date: string; location: string; description: string; imageUrl?: string; cancelled?: boolean; cancellationNote?: string }
function EventCardForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const events: EventItem[] = (content.events as EventItem[]) ?? []
  const update = (i: number, key: string, val: unknown) =>
    onChange({ ...content, events: events.map((ev, idx) => idx === i ? { ...ev, [key]: val } : ev) })
  const add = () => onChange({ ...content, events: [...events, { title: 'Neues Event', date: '', location: '', description: '' }] })
  const remove = (i: number) => onChange({ ...content, events: events.filter((_, idx) => idx !== i) })
  return (
    <div className="flex flex-col gap-4">
      <Field label="Überschrift" value={String(content.heading ?? '')} onChange={v => onChange({ ...content, heading: v })}
        placeholder="Konzerte & Veranstaltungen" />
      {events.map((ev, i) => (
        <div key={i} className={`rounded-lg border p-3 flex flex-col gap-2 ${ev.cancelled ? 'border-red-500/30 bg-red-900/10' : 'border-white/10 bg-slate-900'}`}>
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-300">Event {i + 1}</span>
              {ev.cancelled && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400 font-semibold">ABGESAGT</span>}
            </div>
            <button onClick={() => remove(i)} className="text-xs text-red-400 hover:text-red-300">✕ Entfernen</button>
          </div>
          <Field label="Titel" value={ev.title} onChange={v => update(i, 'title', v)} />
          <Field label="Datum" value={ev.date} onChange={v => update(i, 'date', v)} />
          <Field label="Ort" value={ev.location} onChange={v => update(i, 'location', v)} />
          <Field label="Beschreibung" value={ev.description} onChange={v => update(i, 'description', v)} />
          <ImageField label="Bild (optional)" value={ev.imageUrl ?? ''} onChange={v => update(i, 'imageUrl', v)} />
          <div className={`rounded-lg border p-3 flex flex-col gap-2 ${ev.cancelled ? 'border-red-500/20 bg-red-900/10' : 'border-white/5 bg-slate-800/40'}`}>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={ev.cancelled ?? false} onChange={e => update(i, 'cancelled', e.target.checked)} className="h-4 w-4 accent-red-500 rounded" />
              <span className="text-sm font-medium text-red-400">Veranstaltung absagen</span>
            </label>
            {ev.cancelled && (
              <div>
                <label className="mb-1 block text-xs text-gray-400">Absagegrund (optional, wird Besuchern angezeigt)</label>
                <input
                  value={ev.cancellationNote ?? ''}
                  onChange={e => update(i, 'cancellationNote', e.target.value)}
                  placeholder="z.B. Aufgrund der Hitzewelle muss das Konzert leider entfallen."
                  className="w-full rounded-lg border border-red-500/20 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:border-red-400 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="rounded-lg border border-dashed border-white/20 py-2 text-sm text-gray-400 hover:text-white hover:border-green-500/60 transition">
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

/** Gemeinsame Basis für PersonGridForm und BandGridForm - beide pflegen eine Liste von
 *  Personen mit Foto/Rollen, unterscheiden sich nur in Beschriftung, Akzentfarbe und ob
 *  Bio/E-Mail-Felder gezeigt werden. */
function PersonRosterForm({
  content, onChange, itemLabel = 'Person', ringColorClass = 'ring-green-500/40',
  avatarSizeClass = 'h-20 w-20', avatarTextClass = 'text-green-400',
  cropAccentClass = 'border-green-500/30 bg-green-900/20 text-green-400 hover:bg-green-900/40',
  showBioEmail = true, defaultRole = 'Rolle',
}: {
  content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void
  itemLabel?: string; ringColorClass?: string; avatarSizeClass?: string; avatarTextClass?: string
  cropAccentClass?: string; showBioEmail?: boolean; defaultRole?: string
}) {
  const persons: PersonItem[] = (content.persons as PersonItem[]) ?? []
  const [cropIdx, setCropIdx] = useState<number | null>(null)
  const [pickerIdx, setPickerIdx] = useState<number | null>(null)

  const updatePerson = (i: number, patch: Partial<PersonItem>) =>
    onChange({ ...content, persons: persons.map((p, idx) => idx === i ? { ...p, ...patch } : p) })

  const add = () => onChange({ ...content, persons: [...persons, { name: 'Name', roles: [defaultRole], imageUrl: '', ...(showBioEmail ? { bio: '' } : {}) }] })
  const remove = (i: number) => onChange({ ...content, persons: persons.filter((_, idx) => idx !== i) })

  return (
    <div className="flex flex-col gap-4">
      <Field label="Überschrift" value={String(content.heading ?? '')} onChange={v => onChange({ ...content, heading: v })} />
      {persons.map((p, i) => {
        const roles = p.roles ?? (p.role ? [p.role] : [])
        return (
          <div key={i} className="rounded-lg border border-white/10 bg-slate-900 p-3 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-gray-300">{itemLabel} {i + 1}</span>
              <button onClick={() => remove(i)} className="text-xs text-red-400 hover:text-red-300">✕ Entfernen</button>
            </div>
            <Field label="Name" value={p.name} onChange={v => updatePerson(i, { name: v })} />
            <PersonRolesEditor roles={roles} onChange={r => updatePerson(i, { roles: r, role: undefined })} />
            {showBioEmail && (
              <>
                <Field label="Kurzbiografie" value={p.bio ?? ''} onChange={v => updatePerson(i, { bio: v })} />
                <Field label="E-Mail" value={p.email ?? ''} onChange={v => updatePerson(i, { email: v })} />
              </>
            )}

            {/* Image + crop */}
            <div>
              <label className="mb-1 block text-xs text-gray-400">Foto</label>
              <div className="flex gap-3 items-start">
                <div className={`${avatarSizeClass} flex-shrink-0 overflow-hidden rounded-full ring-2 ${ringColorClass} relative bg-slate-800`}>
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} style={{
                      position: 'absolute', width: '100%', height: '100%', objectFit: 'cover',
                      transform: `scale(${p.imageZoom ?? 1}) translate(${p.imageX ?? 0}px, ${p.imageY ?? 0}px)`,
                      transformOrigin: 'center',
                    }} />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center text-2xl font-bold ${avatarTextClass}`}>
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
                      className={`rounded-lg border px-3 py-1.5 text-xs transition text-left ${cropAccentClass}`}>
                      ✂ Bild zoomen &amp; ausrichten
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
      <button type="button" onClick={add} className="rounded-lg border border-dashed border-white/20 py-2 text-sm text-gray-400 hover:text-white hover:border-green-500/60 transition">
        + {itemLabel} hinzufügen
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

function PersonGridForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return <PersonRosterForm content={content} onChange={onChange} itemLabel="Person" />
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
      <button type="button" onClick={add} className="rounded-lg border border-dashed border-white/20 py-2 text-sm text-gray-400 hover:text-white hover:border-green-500/60 transition">
        + Konzert hinzufügen
      </button>
    </div>
  )
}

// ─── Band Grid Form ───────────────────────────────────────────────────────────
function BandGridForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <PersonRosterForm
      content={content}
      onChange={onChange}
      itemLabel="Mitglied"
      ringColorClass="ring-purple-500/40"
      avatarSizeClass="h-16 w-16"
      avatarTextClass="text-purple-400"
      cropAccentClass="border-purple-500/30 bg-purple-900/20 text-purple-400 hover:bg-purple-900/40"
      showBioEmail={false}
      defaultRole="Instrument"
    />
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
      <button type="button" onClick={addVoice} className="rounded-lg border border-dashed border-white/20 py-2 text-sm text-gray-400 hover:text-white hover:border-green-500/60 transition">
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
  interface TicketsItem { link?: string; priceAdults?: string; priceChildren?: string; info?: string }
  // _key: ephemeral per-session ID for stable expanded state (not saved to backend)
  interface TerminItem { title: string; date: string; time?: string; location?: string; mapUrl?: string; parking?: ParkingItem[]; note?: string; details?: string; tickets?: TicketsItem; kategorie: string; cancelled?: boolean; cancellationNote?: string; meldungId?: string; archivedAfter?: string; _key?: string }
  interface MeldungRef { id: string; title: string }

  const [meldungen, setMeldungen] = useState<MeldungRef[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showArchive, setShowArchive] = useState(false)
  const initDone = useRef(false)

  useEffect(() => {
    fetch(`${API_BASE}/api/site/settings`)
      .then(r => r.json())
      .then((d: Record<string, string>) => {
        if (d.meldungen) try { setMeldungen(JSON.parse(d.meldungen)) } catch { /* */ }
      }).catch(() => {})
  }, [])

  const KATEGORIEN = ['konzert', 'jugend', 'ausflug', 'sonstige']
  const KAT_ICONS: Record<string, string> = { konzert: '🎸', jugend: '🏕️', ausflug: '🚌', sonstige: '📅' }

  const splitDate = (date: string) => {
    const parts = date.split(/\s*[–-]\s*/)
    return { dateFrom: parts[0]?.trim() ?? '', dateTo: parts[1]?.trim() || '' }
  }
  const joinDate = (from: string, to: string) => to.trim() ? `${from} – ${to}` : from

  const isTerminPast = (t: TerminItem) => {
    const { dateFrom, dateTo } = splitDate(t.date)
    const d = dateTo || dateFrom
    const p = d.split('.')
    if (p.length !== 3 || !p[2]) return false
    const dt = new Date(+p[2], +p[1] - 1, +p[0])
    dt.setHours(23, 59, 59, 0)
    return dt < new Date()
  }

  // Sort by start date asc, then by time asc; items without valid date go to end
  const sortKey = (t: TerminItem): number => {
    const start = t.date.replace(/(–|-)[\s\S]*/g, '').trim()
    const p = start.split('.')
    if (p.length === 3 && p[2]) return new Date(+p[2], +p[1] - 1, +p[0]).getTime()
    return Infinity
  }
  const sortedTermine = (list: TerminItem[]) =>
    [...list].sort((a, b) => {
      const d = sortKey(a) - sortKey(b)
      if (d !== 0) return d
      return (a.time?.split('\n')[0]?.trim() ?? '').localeCompare(b.time?.split('\n')[0]?.trim() ?? '')
    })

  // Assign _key on first render (stable across sorts)
  const rawTermine: TerminItem[] = (content.termine as TerminItem[]) ?? []
  const termine: TerminItem[] = rawTermine.map(t => t._key ? t : { ...t, _key: crypto.randomUUID() })
  if (!initDone.current && rawTermine.length > 0) {
    initDone.current = true
    // Sort + assign keys on mount without triggering re-render loop
    const sorted = sortedTermine(termine)
    const needsUpdate = sorted.some((t, i) => t._key !== rawTermine[i]?._key || !rawTermine[i]?._key)
    if (needsUpdate) Promise.resolve().then(() => onChange({ ...content, termine: sorted }))
  }

  // update: patches + re-sorts (for non-date fields where jumping is irrelevant)
  const update = (key: string, patch: Partial<TerminItem>) => {
    const updated = termine.map(t => t._key === key ? { ...t, ...patch } : t)
    onChange({ ...content, termine: sortedTermine(updated) })
  }
  // updateNoSort: patches without re-sorting — used for date inputs while typing
  // to prevent the card from jumping/scrolling on each keystroke
  const updateNoSort = (key: string, patch: Partial<TerminItem>) => {
    const updated = termine.map(t => t._key === key ? { ...t, ...patch } : t)
    onChange({ ...content, termine: updated })
  }
  // Call on date input blur to re-sort after user finishes typing
  const sortNow = () => {
    onChange({ ...content, termine: sortedTermine(termine) })
  }
  const updateTickets = (key: string, patch: Partial<TicketsItem>) => {
    const t = termine.find(t => t._key === key)!
    update(key, { tickets: { ...(t.tickets ?? {}), ...patch } })
  }
  const addNew = () => {
    const newKey = crypto.randomUUID()
    const newTermin: TerminItem = { title: 'Neuer Termin', date: '', location: '', kategorie: 'sonstige', _key: newKey }
    onChange({ ...content, termine: [newTermin, ...termine] })
    setExpanded(prev => new Set([...prev, newKey]))
  }
  const remove = (key: string) => {
    if (!confirm('Termin wirklich löschen?')) return
    onChange({ ...content, termine: termine.filter(t => t._key !== key) })
    setExpanded(prev => { const s = new Set(prev); s.delete(key); return s })
  }
  const addParking = (key: string) => { const t = termine.find(t => t._key === key)!; update(key, { parking: [...(t.parking ?? []), { name: '', mapUrl: '' }] }) }
  const updateParking = (key: string, pi: number, patch: Partial<ParkingItem>) => {
    const t = termine.find(t => t._key === key)!
    update(key, { parking: (t.parking ?? []).map((p, idx) => idx === pi ? { ...p, ...patch } : p) })
  }
  const removeParking = (key: string, pi: number) => {
    const t = termine.find(t => t._key === key)!
    update(key, { parking: (t.parking ?? []).filter((_, idx) => idx !== pi) })
  }
  const toggleExpanded = (key: string) =>
    setExpanded(prev => { const s = new Set(prev); if (s.has(key)) s.delete(key); else s.add(key); return s })

  const activeTermine  = termine.filter(t => !isTerminPast(t))
  const archiveTermine = termine.filter(t => isTerminPast(t))

  const renderTermin = (t: TerminItem) => {
    const key = t._key!
    const isOpen = expanded.has(key)
    const past = isTerminPast(t)
    const { dateFrom, dateTo } = splitDate(t.date)

    return (
      <div key={key} className={`rounded-xl border overflow-hidden transition ${
        t.cancelled ? 'border-red-500/30 bg-red-900/10' : past ? 'border-white/8 bg-slate-900/60 opacity-70' : 'border-white/10 bg-slate-900'
      }`}>
        {/* Header row */}
        <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none" onClick={() => toggleExpanded(key)}>
          <span className="text-base shrink-0">{KAT_ICONS[t.kategorie] ?? '📅'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{t.title || <span className="italic text-gray-500">Ohne Titel</span>}</p>
            {t.date && <p className="text-[11px] text-gray-500 font-mono mt-0.5">{t.date}</p>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {t.cancelled && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-400 font-bold uppercase">Abgesagt</span>}
            {past && !t.cancelled && <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-gray-600">Vergangen</span>}
            <span className="text-gray-600 text-xs">{isOpen ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Edit form */}
        {isOpen && (
          <div className="border-t border-white/8 p-3 flex flex-col gap-3">
            <Field label="Bezeichnung" value={t.title} onChange={v => update(key, { title: v })} />

            {/* Von / Bis — sort triggers on blur */}
            <div className="rounded-lg border border-white/8 bg-slate-800/50 p-3 flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">📅 Datum</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-400">Von <span className="text-gray-600">(Pflichtfeld)</span></label>
                  <input value={dateFrom}
                    onChange={e => updateNoSort(key, { date: joinDate(e.target.value, dateTo) })}
                    onBlur={sortNow}
                    placeholder="dd.MM.yyyy"
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white font-mono placeholder-gray-600 focus:border-green-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">Bis <span className="text-gray-600">(optional)</span></label>
                  <input value={dateTo}
                    onChange={e => updateNoSort(key, { date: joinDate(dateFrom, e.target.value) })}
                    onBlur={sortNow}
                    placeholder="dd.MM.yyyy"
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white font-mono placeholder-gray-600 focus:border-green-500 focus:outline-none" />
                </div>
              </div>
            </div>

            {/* Uhrzeit(en) */}
            <div>
              <label className="mb-1 block text-xs text-gray-400">
                🕐 Uhrzeit(en)
                <span className="ml-1 text-gray-600">(mehrere Zeilen für mehrere Tage/Zeiten)</span>
              </label>
              <textarea value={t.time ?? ''} onChange={e => update(key, { time: e.target.value })} rows={2}
                placeholder={'19:00\noder:\nFr: 17:00\nSa: 10:00 – 17:00\nSo: 11:00'}
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-green-500 focus:outline-none resize-y" />
            </div>

            <Field label="Ort" value={t.location ?? ''} onChange={v => update(key, { location: v })} />
            <Field label="📍 Google-Maps-Link" value={t.mapUrl ?? ''} onChange={v => update(key, { mapUrl: v })} placeholder="https://maps.google.com/?q=..." />

            {/* Parkplätze */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs text-gray-400">🅿️ Parkplätze</label>
                <button onClick={() => addParking(key)} className="text-xs text-green-400 hover:text-green-300 transition">+ hinzufügen</button>
              </div>
              {(t.parking ?? []).map((p, pi) => (
                <div key={pi} className="flex gap-2 mb-1 items-center">
                  <input value={p.name ?? ''} onChange={e => updateParking(key, pi, { name: e.target.value })} placeholder="Name"
                    className="flex-1 rounded-lg border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white placeholder-gray-600 focus:border-green-500 focus:outline-none" />
                  <input value={p.mapUrl} onChange={e => updateParking(key, pi, { mapUrl: e.target.value })} placeholder="Maps-Link"
                    className="flex-[2] rounded-lg border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white font-mono placeholder-gray-600 focus:border-green-500 focus:outline-none" />
                  <button onClick={() => removeParking(key, pi)} className="text-xs text-red-400 hover:text-red-300 px-1">✕</button>
                </div>
              ))}
            </div>

            <Field label="Kurze Notiz (1 Zeile)" value={t.note ?? ''} onChange={v => update(key, { note: v })} placeholder="z.B. Eintritt frei!" />

            <div>
              <label className="mb-1 block text-xs text-gray-400">Weitere Infos (mehrzeilig)</label>
              <textarea value={t.details ?? ''} onChange={e => update(key, { details: e.target.value })} rows={3} placeholder="Zusätzliche Infos, Hinweise, Programmablauf..."
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-green-500 focus:outline-none resize-y" />
            </div>

            {/* Tickets */}
            <div className="rounded-lg border border-white/8 bg-slate-800/50 p-3 flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">🎟️ Ticket-Infos (optional)</p>
              <div className="flex gap-2">
                <div className="flex-1"><Field label="Preis Erwachsene" value={t.tickets?.priceAdults ?? ''} onChange={v => updateTickets(key, { priceAdults: v })} placeholder="12 €" /></div>
                <div className="flex-1"><Field label="Preis Kinder" value={t.tickets?.priceChildren ?? ''} onChange={v => updateTickets(key, { priceChildren: v })} placeholder="5 € / frei bis 12 J." /></div>
              </div>
              <Field label="Ticket-Hinweis" value={t.tickets?.info ?? ''} onChange={v => updateTickets(key, { info: v })} placeholder="z.B. Kasse ab 18 Uhr, Einlass 19 Uhr" />
              <Field label="Ticket-Link" value={t.tickets?.link ?? ''} onChange={v => updateTickets(key, { link: v })} placeholder="https://..." />
            </div>

            {/* Kategorie */}
            <div>
              <label className="mb-1 block text-xs text-gray-400">Kategorie</label>
              <div className="flex gap-2 flex-wrap">
                {KATEGORIEN.map(k => (
                  <button key={k} type="button" onClick={() => update(key, { kategorie: k })}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${t.kategorie === k ? 'bg-green-900/40 border-green-500/40 text-green-400' : 'bg-slate-800 border-white/10 text-gray-400 hover:text-white'}`}>
                    {KAT_ICONS[k]} {k}
                  </button>
                ))}
              </div>
            </div>

            {/* Archivierung */}
            <div className="rounded-lg border border-white/5 bg-slate-800/40 p-3 flex flex-col gap-1.5">
              <label className="mb-0.5 block text-xs text-gray-400 font-medium">
                Nicht mehr anzeigen ab
                <span className="ml-1 font-normal text-gray-600">(optional – versteckt in Konzert- & Next-Ansicht, bleibt im Kalender)</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input type="text" value={t.archivedAfter ?? ''} onChange={e => update(key, { archivedAfter: e.target.value })}
                  placeholder="dd.MM.yyyy"
                  className="w-36 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white font-mono focus:border-slate-400 focus:outline-none" />
                {t.archivedAfter && (
                  <button type="button" onClick={() => update(key, { archivedAfter: undefined })}
                    className="text-xs text-gray-500 hover:text-white transition">✕ löschen</button>
                )}
                <span className="text-xs text-gray-600">z.B. Tag nach dem Konzert</span>
              </div>
            </div>

            {/* Absage */}
            <div className={`rounded-lg border p-3 flex flex-col gap-2 ${t.cancelled ? 'border-red-500/20 bg-red-900/10' : 'border-white/5 bg-slate-800/40'}`}>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={t.cancelled ?? false} onChange={e => update(key, { cancelled: e.target.checked })} className="h-4 w-4 accent-red-500 rounded" />
                <span className="text-sm font-medium text-red-400">Veranstaltung absagen</span>
              </label>
              {t.cancelled && (
                <>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">Absagegrund (optional)</label>
                    <input value={t.cancellationNote ?? ''} onChange={e => update(key, { cancellationNote: e.target.value })}
                      placeholder="z.B. Aufgrund der Hitzewelle muss das Konzert leider entfallen."
                      className="w-full rounded-lg border border-red-500/20 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:border-red-400 focus:outline-none" />
                  </div>
                  {meldungen.length > 0 && (
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">Verknüpfte Meldung <span className="text-gray-600">(öffnet Popup bei „Weitere Infos")</span></label>
                      <select value={t.meldungId ?? ''} onChange={e => update(key, { meldungId: e.target.value || undefined })}
                        className="w-full rounded-lg border border-red-500/20 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-red-400 focus:outline-none">
                        <option value="">— keine Meldung —</option>
                        {meldungen.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>

            <button onClick={() => remove(key)}
              className="self-start rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/50 transition">
              🗑 Termin löschen
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Überschrift" value={String(content.heading ?? 'Termine')} onChange={v => onChange({ ...content, heading: v })} />

      <button type="button" onClick={addNew}
        className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-green-500/40 bg-green-900/10 py-2.5 text-sm text-green-400 hover:bg-green-900/20 hover:border-green-500/70 transition">
        + Neuer Termin
      </button>

      {activeTermine.length === 0 && archiveTermine.length === 0 && (
        <p className="text-center text-sm text-gray-600 py-4">Noch keine Termine. Oben einen neuen anlegen.</p>
      )}
      {activeTermine.map(t => renderTermin(t))}

      {archiveTermine.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setShowArchive(v => !v)}
            className="flex w-full items-center gap-2 rounded-lg border border-white/8 bg-slate-900/50 px-4 py-2.5 text-left text-xs text-gray-500 hover:text-gray-300 transition">
            <span className={`transition-transform ${showArchive ? 'rotate-90' : ''}`}>▸</span>
            Archiv – {archiveTermine.length} vergangene{archiveTermine.length === 1 ? 'r' : ''} Termin{archiveTermine.length === 1 ? '' : 'e'}
          </button>
          {showArchive && (
            <div className="mt-2 flex flex-col gap-2">
              {archiveTermine.map(t => renderTermin(t))}
            </div>
          )}
        </div>
      )}
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
      <button type="button" onClick={add} className="rounded-lg border border-dashed border-white/20 py-2 text-sm text-gray-400 hover:text-white hover:border-green-500/60 transition">
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
  _newId?: string
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
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set())
  const [sortMode, setSortMode] = useState<'manual' | 'name-asc' | 'name-desc'>('name-asc')
  const [newSponsorIds, setNewSponsorIds] = useState<Set<string>>(new Set())

  // Toggle für Einklapp-Funktion
  const toggleExpanded = (i: number) => {
    const newSet = new Set(expandedIndices)
    if (newSet.has(i)) newSet.delete(i)
    else newSet.add(i)
    setExpandedIndices(newSet)
  }
  
  // Prüfen, ob ein Sponsor eingeklappt ist
  const isExpanded = (i: number) => expandedIndices.has(i)
  
  // Sortierfunktion: neue Sponsoren bleiben am Ende, bis explizit sortiert wird
  const getSortedSponsors = () => {
    const existing = sponsors.filter(s => !s._newId || !newSponsorIds.has(s._newId))
    const newOnes  = sponsors.filter(s => s._newId && newSponsorIds.has(s._newId))
    switch (sortMode) {
      case 'name-asc':
        existing.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'name-desc':
        existing.sort((a, b) => b.name.localeCompare(a.name))
        break
      case 'manual':
      default:
        break
    }
    return [...existing, ...newOnes]
  }
  
  const update = (i: number, patch: Partial<SponsorItem>) => {
    const sorted = getSortedSponsors()
    const actualIndex = sponsors.findIndex(s => s === sorted[i])
    onChange({
      ...content,
      sponsors: sponsors.map((s, idx) => idx === actualIndex ? { ...s, ...patch } : s)
    })
  }
  
  const add = () => {
    const newId = Math.random().toString(36).slice(2)
    const newSponsor: SponsorItem = { name: 'Neuer Sponsor', _newId: newId }
    setNewSponsorIds(prev => new Set([...prev, newId]))
    onChange({
      ...content,
      sponsors: [...sponsors, newSponsor]
    })
  }
  
  const remove = (i: number) => {
    const sorted = getSortedSponsors()
    const sponsorToRemove = sorted[i]
    if (sponsorToRemove._newId) {
      setNewSponsorIds(prev => { const s = new Set(prev); s.delete(sponsorToRemove._newId!); return s })
    }
    const actualIndex = sponsors.findIndex(s => s === sorted[i])
    onChange({
      ...content,
      sponsors: sponsors.filter((_, idx) => idx !== actualIndex)
    })
  }
  
  const move = (i: number, dir: -1 | 1) => {
    const sorted = getSortedSponsors()
    const arr = [...sorted]
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    // Original-Reihenfolge beibehalten, aber Positionen aktualisieren
    const originalOrder = [...sponsors]
    const newOrder = originalOrder.map(s => {
      const posInSorted = arr.findIndex(item => item === s)
      return arr[posInSorted] || s
    })
    onChange({ ...content, sponsors: newOrder })
  }
  
  // Alle Sponsoren sortieren (inkl. neuer)
  const sortAll = (mode: 'manual' | 'name-asc' | 'name-desc') => {
    setSortMode(mode)
    setNewSponsorIds(new Set()) // Alle als "sortiert" markieren
    if (mode === 'manual') return
    
    const sorted = [...sponsors].sort((a, b) => {
      const comparison = a.name.localeCompare(b.name)
      return mode === 'name-asc' ? comparison : -comparison
    })
    onChange({ ...content, sponsors: sorted })
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Überschrift" value={String(content.heading ?? '')} onChange={v => onChange({ ...content, heading: v })} />
      <div>
        <label className="mb-1 block text-xs text-gray-400">Einleitungstext</label>
        <textarea value={String(content.intro ?? '')} onChange={e => onChange({ ...content, intro: e.target.value })} rows={2}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-gray-200 focus:border-green-500 focus:outline-none resize-y" />
      </div>
      
      {/* Sortierfunktion */}
      <div className="flex flex-col gap-2 p-3 rounded-lg border border-white/10 bg-slate-800">
        <label className="text-xs font-bold text-gray-300">Sortierung</label>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => sortAll('name-asc')}
            className={`px-3 py-1 rounded-lg text-xs transition ${sortMode === 'name-asc' ? 'bg-green-600 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}`}
          >
            A-Z
          </button>
          <button
            onClick={() => sortAll('name-desc')}
            className={`px-3 py-1 rounded-lg text-xs transition ${sortMode === 'name-desc' ? 'bg-green-600 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}`}
          >
            Z-A
          </button>
          <button
            onClick={() => sortAll('manual')}
            className={`px-3 py-1 rounded-lg text-xs transition ${sortMode === 'manual' ? 'bg-green-600 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}`}
          >
            Manuell
          </button>
        </div>
        <p className="text-xs text-gray-500">
          {sortMode === 'name-asc' ? 'Aktuell: Alphabetisch (A-Z)' :
           sortMode === 'name-desc' ? 'Aktuell: Alphabetisch (Z-A)' :
           'Aktuell: Manuelle Sortierung'}
        </p>
      </div>
      
      <p className="text-xs text-gray-500">{sponsors.length} Sponsoren</p>
      {getSortedSponsors().map((s, i) => (
        <div key={i} className={`rounded-lg border bg-slate-900 p-3 flex flex-col gap-2 ${s._newId && newSponsorIds.has(s._newId) ? 'border-green-500/40' : 'border-white/10'}`}>
          <div className="flex justify-between items-center flex-wrap gap-1">
            <div className="flex items-center gap-2">
              <button onClick={() => toggleExpanded(i)} className="text-xs text-gray-400 hover:text-white">
                {isExpanded(i) ? '▼' : '▶'}
              </button>
              <span className="text-xs font-bold text-gray-300">Sponsor {i + 1}: {s.name || 'Unbenannter Sponsor'}</span>
              {s._newId && newSponsorIds.has(s._newId) && (
                <span className="text-xs text-green-400 bg-green-950/40 px-1.5 py-0.5 rounded">Neu – noch nicht sortiert</span>
              )}
            </div>
            <div className="flex gap-1">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-xs text-gray-500 hover:text-white px-1 disabled:opacity-30">↑</button>
              <button onClick={() => move(i, 1)} disabled={i === getSortedSponsors().length - 1} className="text-xs text-gray-500 hover:text-white px-1 disabled:opacity-30">↓</button>
              <button onClick={() => remove(i)} className="text-xs text-red-400 hover:text-red-300 ml-1">✕ Entfernen</button>
            </div>
          </div>
          <Field label="Firmenname *" value={s.name} onChange={v => update(i, { name: v })} />
          <Field label="Kontaktperson (optional)" value={s.person ?? ''} onChange={v => update(i, { person: v })} placeholder="z.B. Nina Winkler" />
       {/* Eingeklappten Inhalt anzeigen/verbergen */}
       {isExpanded(i) && (
         <div className="mt-2 pt-2 border-t border-white/10">
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
       )}
        </div>
      ))}
      <button type="button" onClick={add} className="rounded-lg border border-dashed border-white/20 py-2 text-sm text-gray-400 hover:text-white hover:border-green-500/60 transition">
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

// ─── TermineKonzerteForm ──────────────────────────────────────────────────────
function TermineKonzerteForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-gray-400 italic">
        Zeigt automatisch alle kommenden Konzerte aus der Terminliste an. Kein manuelles Pflegen nötig.
      </p>
      <div>
        <label className="mb-1 block text-xs text-gray-400">Überschrift</label>
        <input value={String(content.heading ?? 'Konzerte & Veranstaltungen')}
          onChange={e => onChange({ ...content, heading: e.target.value })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-green-500 focus:outline-none" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-400">Max. Anzahl Karten (Standard: 6)</label>
        <input type="number" min={1} max={24} value={Number(content.maxItems ?? 6)}
          onChange={e => onChange({ ...content, maxItems: parseInt(e.target.value) || 6 })}
          className="w-32 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-green-500 focus:outline-none" />
      </div>
    </div>
  )
}

// ─── InternChangelog Form ─────────────────────────────────────────────────────
function InternChangelogForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  interface EntryItem { date: string; title: string; content: string; type: string }
  const entries: EntryItem[] = (content.entries as EntryItem[]) ?? []
  const TYPES = ['new', 'update', 'fix', 'info']
  const TYPE_ICONS: Record<string, string> = { new: '🆕', update: '🔄', fix: '🔧', info: 'ℹ️' }
  const TYPE_LABELS: Record<string, string> = { new: 'Neu', update: 'Update', fix: 'Fix', info: 'Info' }

  const update = (i: number, patch: Partial<EntryItem>) =>
    onChange({ ...content, entries: entries.map((e, idx) => idx === i ? { ...e, ...patch } : e) })
  const add = () => onChange({
    ...content,
    entries: [{ date: new Date().toLocaleDateString('de-DE'), title: 'Neuer Eintrag', content: '', type: 'new' }, ...entries],
  })
  const remove = (i: number) => onChange({ ...content, entries: entries.filter((_, idx) => idx !== i) })

  return (
    <div className="flex flex-col gap-4">
      <Field label="Überschrift" value={String(content.heading ?? 'Was ist neu?')} onChange={v => onChange({ ...content, heading: v })} />
      <button type="button" onClick={add}
        className="rounded-lg border border-dashed border-green-500/30 bg-green-900/10 py-2 text-sm text-green-400 hover:bg-green-900/20 transition">
        + Eintrag oben hinzufügen
      </button>
      {entries.map((e, i) => (
        <div key={i} className="rounded-lg border border-white/10 bg-slate-900 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-gray-300">Eintrag {i + 1}</span>
            <button onClick={() => remove(i)} className="text-xs text-red-400 hover:text-red-300">✕ entfernen</button>
          </div>
          <div className="flex gap-2">
            <div className="w-36"><Field label="Datum" value={e.date} onChange={v => update(i, { date: v })} placeholder="25.04.2026" /></div>
            <div className="flex-1"><Field label="Titel" value={e.title} onChange={v => update(i, { title: v })} /></div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Typ</label>
            <div className="flex gap-1.5 flex-wrap">
              {TYPES.map(t => (
                <button key={t} type="button" onClick={() => update(i, { type: t })}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${e.type === t
                    ? 'bg-green-900/40 border-green-500/40 text-green-400'
                    : 'bg-slate-800 border-white/10 text-gray-400 hover:text-white'}`}>
                  {TYPE_ICONS[t]} {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Inhalt</label>
            <textarea value={e.content} onChange={ev => update(i, { content: ev.target.value })} rows={3}
              placeholder="Was wurde hinzugefügt, geändert oder behoben?"
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-green-500 focus:outline-none resize-y" />
          </div>
        </div>
      ))}
      {entries.length === 0 && (
        <p className="text-xs text-gray-500 italic text-center py-2">Noch keine Einträge. Klicke oben, um einen hinzuzufügen.</p>
      )}
    </div>
  )
}

// ─── Image & Text Form ────────────────────────────────────────────────────────
function ImageTextForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...content, [key]: val })
  const position = String(content.imagePosition ?? 'left')
  return (
    <div className="flex flex-col gap-3">
      <Field label="Überschrift (optional)" value={String(content.heading ?? '')} onChange={v => set('heading', v)} />
      <div>
        <label className="mb-1 block text-xs text-gray-400">Bildposition</label>
        <div className="flex gap-2">
          {(['left', 'right'] as const).map(p => (
            <button key={p} type="button" onClick={() => set('imagePosition', p)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${position === p ? 'bg-green-900/40 border-green-500/40 text-green-400' : 'bg-slate-800 border-white/10 text-gray-400 hover:text-white'}`}>
              {p === 'left' ? 'Bild links' : 'Bild rechts'}
            </button>
          ))}
        </div>
      </div>
      <ImageField label="Bild" value={String(content.imageUrl ?? '')} onChange={v => set('imageUrl', v)} />
      <div>
        <label className="mb-1 block text-xs text-gray-400">Text (Markdown)</label>
        <textarea value={String(content.markdown ?? '')} onChange={e => set('markdown', e.target.value)} rows={6}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-gray-200 focus:border-green-500 focus:outline-none resize-y" />
      </div>
    </div>
  )
}

// ─── Aufruf-Button Form ───────────────────────────────────────────────────────
function CtaButtonForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...content, [key]: val })
  return (
    <div className="flex flex-col gap-3">
      <Field label="Überschrift (optional)" value={String(content.heading ?? '')} onChange={v => set('heading', v)} />
      <div>
        <label className="mb-1 block text-xs text-gray-400">Text (optional)</label>
        <textarea value={String(content.text ?? '')} onChange={e => set('text', e.target.value)} rows={2}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-gray-200 focus:border-green-500 focus:outline-none resize-y" />
      </div>
      <Field label="Button-Text" value={String(content.buttonLabel ?? '')} onChange={v => set('buttonLabel', v)} placeholder="z.B. Jetzt anmelden" />
      <Field label="Button-Ziel (Link)" value={String(content.buttonHref ?? '')} onChange={v => set('buttonHref', v)} placeholder="z.B. /beitritt oder https://…" />
    </div>
  )
}

// ─── FAQ Form ─────────────────────────────────────────────────────────────────
function FaqForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  interface FaqItem { question: string; answer: string }
  const items: FaqItem[] = (content.items as FaqItem[]) ?? []
  const update = (i: number, patch: Partial<FaqItem>) =>
    onChange({ ...content, items: items.map((it, idx) => idx === i ? { ...it, ...patch } : it) })
  const add = () => onChange({ ...content, items: [...items, { question: 'Neue Frage', answer: '' }] })
  const remove = (i: number) => onChange({ ...content, items: items.filter((_, idx) => idx !== i) })
  return (
    <div className="flex flex-col gap-4">
      <Field label="Überschrift (optional)" value={String(content.heading ?? '')} onChange={v => onChange({ ...content, heading: v })} />
      {items.map((it, i) => (
        <div key={i} className="rounded-lg border border-white/10 bg-slate-900 p-3 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-300">Frage {i + 1}</span>
            <button onClick={() => remove(i)} className="text-xs text-red-400 hover:text-red-300">✕ entfernen</button>
          </div>
          <Field label="Frage" value={it.question} onChange={v => update(i, { question: v })} />
          <div>
            <label className="mb-1 block text-xs text-gray-400">Antwort</label>
            <textarea value={it.answer} onChange={e => update(i, { answer: e.target.value })} rows={3}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs text-white focus:border-green-500 focus:outline-none resize-y" />
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="rounded-lg border border-dashed border-white/20 py-2 text-sm text-gray-400 hover:text-white hover:border-green-500/60 transition">
        + Frage hinzufügen
      </button>
    </div>
  )
}

// ─── Spacer Form ──────────────────────────────────────────────────────────────
function SpacerForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const size = String(content.size ?? 'md')
  const showLine = Boolean(content.showLine)
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-xs text-gray-400">Höhe</label>
        <div className="flex gap-2">
          {(['sm', 'md', 'lg'] as const).map(s => (
            <button key={s} type="button" onClick={() => onChange({ ...content, size: s })}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${size === s ? 'bg-green-900/40 border-green-500/40 text-green-400' : 'bg-slate-800 border-white/10 text-gray-400 hover:text-white'}`}>
              {s === 'sm' ? 'Klein' : s === 'md' ? 'Mittel' : 'Groß'}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input type="checkbox" checked={showLine} onChange={e => onChange({ ...content, showLine: e.target.checked })}
          className="h-4 w-4 rounded border-white/20 bg-slate-800 accent-green-500" />
        Dünne Trennlinie anzeigen
      </label>
    </div>
  )
}

// ─── Zitat Form ───────────────────────────────────────────────────────────────
function QuoteForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...content, [key]: val })
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-xs text-gray-400">Zitat</label>
        <textarea value={String(content.quote ?? '')} onChange={e => set('quote', e.target.value)} rows={3}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-gray-200 focus:border-green-500 focus:outline-none resize-y" />
      </div>
      <Field label="Name (optional)" value={String(content.author ?? '')} onChange={v => set('author', v)} />
      <Field label="Rolle/Zusatz (optional)" value={String(content.role ?? '')} onChange={v => set('role', v)} placeholder="z.B. Vorstand oder Mitglied seit 1998" />
    </div>
  )
}

// ─── Statistik Form ───────────────────────────────────────────────────────────
function StatsForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  interface StatItem { value: string; label: string }
  const items: StatItem[] = (content.items as StatItem[]) ?? []
  const update = (i: number, patch: Partial<StatItem>) =>
    onChange({ ...content, items: items.map((it, idx) => idx === i ? { ...it, ...patch } : it) })
  const add = () => onChange({ ...content, items: [...items, { value: '100+', label: 'Beschriftung' }] })
  const remove = (i: number) => onChange({ ...content, items: items.filter((_, idx) => idx !== i) })
  return (
    <div className="flex flex-col gap-4">
      <Field label="Überschrift (optional)" value={String(content.heading ?? '')} onChange={v => onChange({ ...content, heading: v })} />
      {items.map((it, i) => (
        <div key={i} className="rounded-lg border border-white/10 bg-slate-900 p-3 flex gap-2 items-end">
          <div className="flex-1"><Field label="Wert" value={it.value} onChange={v => update(i, { value: v })} placeholder="z.B. seit 1975" /></div>
          <div className="flex-1"><Field label="Beschriftung" value={it.label} onChange={v => update(i, { label: v })} placeholder="z.B. Mitglieder" /></div>
          <button onClick={() => remove(i)} className="mb-1.5 text-xs text-red-400 hover:text-red-300 whitespace-nowrap">✕ entfernen</button>
        </div>
      ))}
      <button type="button" onClick={add} className="rounded-lg border border-dashed border-white/20 py-2 text-sm text-gray-400 hover:text-white hover:border-green-500/60 transition">
        + Zahl hinzufügen
      </button>
    </div>
  )
}

// ─── Video-Einbettung Form ────────────────────────────────────────────────────
function VideoEmbedForm({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...content, [key]: val })
  return (
    <div className="flex flex-col gap-3">
      <Field label="Überschrift (optional)" value={String(content.heading ?? '')} onChange={v => set('heading', v)} />
      <Field label="Video-Link" value={String(content.videoUrl ?? '')} onChange={v => set('videoUrl', v)} placeholder="YouTube- oder Vimeo-Link" />
      <Field label="Bildunterschrift (optional)" value={String(content.caption ?? '')} onChange={v => set('caption', v)} />
    </div>
  )
}

// ─── Section Editor ───────────────────────────────────────────────────────────
function SectionEditor({ section, pageSlug, onSaved, onDeleted, dragHandleProps, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: {
  section: SectionResponse; pageSlug: string; onSaved: () => void; onDeleted: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  onMoveUp?: () => void; onMoveDown?: () => void; canMoveUp?: boolean; canMoveDown?: boolean
}) {
  const { showToast } = useToast()
  const [content, setContent] = useState<Record<string, unknown>>(section.content)
  const [expertMode, setExpertMode] = useState(false)
  const [rawJson, setRawJson] = useState(JSON.stringify(section.content, null, 2))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showPreview, setShowPreview] = useState(true)

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
      if (res.ok) { showToast('Sektion gespeichert.', 'success'); onSaved() }
      else { setError('Speichern fehlgeschlagen.'); showToast('Speichern fehlgeschlagen.', 'error') }
    } catch { setError('Fehler.'); showToast('Speichern fehlgeschlagen.', 'error') } finally { setSaving(false) }
  }

  const del = async () => {
    setConfirmDelete(false)
    await fetch(`${API_BASE}/api/pages/${pageSlug}/sections/${section.id}`, { method: 'DELETE', credentials: 'include' })
    showToast('Sektion gelöscht.', 'success')
    onDeleted()
  }

  const toggleExpert = () => {
    if (!expertMode) setRawJson(JSON.stringify(content, null, 2))
    else { try { setContent(JSON.parse(rawJson)) } catch { /* keep */ } }
    setExpertMode(e => !e)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4">
      <ConfirmDialog
        open={confirmDelete}
        title="Sektion löschen"
        message={`"${sectionTypeInfo(section.type).label}" wirklich löschen? Das kann nicht rückgängig gemacht werden.`}
        confirmLabel="Löschen"
        onConfirm={del}
        onCancel={() => setConfirmDelete(false)}
      />
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {dragHandleProps && (
            <button type="button" {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing rounded px-1.5 py-1 text-gray-500 hover:text-gray-300 touch-none" title="Ziehen zum Verschieben">
              ⠿
            </button>
          )}
          {(onMoveUp || onMoveDown) && (
            <div className="flex flex-col -my-1">
              <button type="button" onClick={onMoveUp} disabled={!canMoveUp}
                className="px-1 text-[10px] leading-tight text-gray-500 hover:text-white disabled:opacity-20 disabled:hover:text-gray-500 transition" title="Nach oben verschieben">▲</button>
              <button type="button" onClick={onMoveDown} disabled={!canMoveDown}
                className="px-1 text-[10px] leading-tight text-gray-500 hover:text-white disabled:opacity-20 disabled:hover:text-gray-500 transition" title="Nach unten verschieben">▼</button>
            </div>
          )}
          <span className="flex items-center gap-1.5 rounded-lg border border-green-500/20 bg-green-900/30 px-2.5 py-1 text-xs font-semibold text-green-400 whitespace-nowrap">
            <span>{sectionTypeInfo(section.type).icon}</span>
            {sectionTypeInfo(section.type).label}
          </span>
          <span className="hidden sm:inline text-xs text-gray-500 truncate">{sectionTypeInfo(section.type).hint}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => setShowPreview(v => !v)}
            className={`rounded px-2 py-1 text-xs transition ${showPreview ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-gray-400 hover:text-white'}`}>
            {showPreview ? '👁 Vorschau an' : '👁 Vorschau aus'}
          </button>
          <button type="button" onClick={toggleExpert}
            className={`rounded px-2 py-1 text-xs transition ${expertMode ? 'bg-yellow-800/40 text-yellow-400' : 'bg-slate-700 text-gray-400 hover:text-white'}`}>
            {expertMode ? '🔧 Expertenmode (aktiv)' : '🔧 Expertenmode'}
          </button>
          <button type="button" onClick={() => setConfirmDelete(true)} className="rounded px-2 py-1 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 transition">Löschen</button>
        </div>
      </div>

      <div className={showPreview ? 'grid grid-cols-1 gap-4 lg:grid-cols-2' : ''}>
        <div>
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
              {section.type === 'ACTIVITY_GRID'     && <ActivityGridForm content={content} onChange={setContent} />}
              {section.type === 'SPONSOR_GRID'      && <SponsorGridForm content={content} onChange={setContent} />}
              {section.type === 'TERMINE_KONZERTE'  && <TermineKonzerteForm content={content} onChange={setContent} />}
              {section.type === 'INTERN_CHANGELOG' && <InternChangelogForm content={content} onChange={setContent} />}
              {section.type === 'IMAGE_TEXT'    && <ImageTextForm content={content} onChange={setContent} />}
              {section.type === 'CTA_BUTTON'    && <CtaButtonForm content={content} onChange={setContent} />}
              {section.type === 'FAQ'           && <FaqForm content={content} onChange={setContent} />}
              {section.type === 'SPACER'        && <SpacerForm content={content} onChange={setContent} />}
              {section.type === 'QUOTE'         && <QuoteForm content={content} onChange={setContent} />}
              {section.type === 'STATS'         && <StatsForm content={content} onChange={setContent} />}
              {section.type === 'VIDEO_EMBED'   && <VideoEmbedForm content={content} onChange={setContent} />}
            </div>
          )}

          {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
          <button type="button" onClick={save} disabled={saving}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">
            {saving ? 'Speichert…' : '✓ Speichern'}
          </button>
        </div>

        {showPreview && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Live-Vorschau</p>
            <div className="max-h-[420px] overflow-y-auto rounded-lg border border-white/10">
              <PreviewErrorBoundary>
                {/* section.type ist im Admin-Bereich ein loser String (auch unbekannte Werte möglich),
                    SectionResolver erwartet den strikten SectionType-Union aus types/page.ts - daher der Cast. */}
                <SectionResolver section={{ id: section.id, type: section.type, position: section.position, content } as any} />
              </PreviewErrorBoundary>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Nav Config Editor ────────────────────────────────────────────────────────
type NavVisibility = 'public' | 'member' | 'admin' | 'guest'
interface AdminNavDropdownGroup { label: string; target?: string; items: string[]; visibility?: NavVisibility }
interface AdminNavFixedLink { label: string; href: string; visibility?: NavVisibility; items?: { label: string; href: string }[] }
interface AdminNavConfig { dropdowns: AdminNavDropdownGroup[]; hidden?: string[]; fixedLinks?: AdminNavFixedLink[] }

const VISIBILITY_OPTIONS: { value: NavVisibility; label: string; icon: string }[] = [
  { value: 'public',  label: 'Alle',       icon: '🌍' },
  { value: 'member',  label: 'Angemeldet', icon: '👤' },
  { value: 'admin',   label: 'Nur Admin',  icon: '🔑' },
  { value: 'guest',   label: 'Nur Gäste',  icon: '👻' },
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

/** Schneller Sichtbarkeits-Umschalter direkt in der Seitenliste, ohne den Umweg über
 *  den separaten Navigations-Editor. Liest/schreibt nav_config.hidden eigenständig
 *  (frisches Read-Modify-Write bei jedem Klick), damit nichts mit unabhängig offenen
 *  Änderungen im Einstellungen-Tab kollidiert. "Veröffentlicht" (Entwurf/live) und
 *  "im Menü sichtbar" sind bewusst getrennte Schalter - siehe Hilfe-Panel. */
function PageVisibilityToggle({ slug }: { slug: string }) {
  const { showToast } = useToast()
  const [hidden, setHidden] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/api/admin/settings`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const cfg = normalizeAdminNavConfig(JSON.parse(data.nav_config || '{}'))
        setHidden((cfg.hidden ?? []).includes(slug))
      })
      .catch(() => { if (!cancelled) setHidden(false) })
    return () => { cancelled = true }
  }, [slug])

  const toggle = async () => {
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, { credentials: 'include' })
      const data = await res.json()
      const cfg = normalizeAdminNavConfig(JSON.parse(data.nav_config || '{}'))
      const nowHidden = (cfg.hidden ?? []).includes(slug)
      const nextHidden = nowHidden ? (cfg.hidden ?? []).filter((s: string) => s !== slug) : [...(cfg.hidden ?? []), slug]
      const nextCfg = { ...cfg, hidden: nextHidden }
      await fetch(`${API_BASE}/api/admin/settings`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, nav_config: JSON.stringify(nextCfg) }),
      })
      setHidden(!nowHidden)
      showToast(!nowHidden ? 'Seite im Menü versteckt.' : 'Seite im Menü sichtbar.', 'success')
    } catch {
      showToast('Menü-Sichtbarkeit konnte nicht geändert werden.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (hidden === null) return <span className="text-xs text-gray-600">…</span>

  return (
    <button type="button" onClick={toggle} disabled={busy}
      className={`rounded px-2 py-1 text-xs transition disabled:opacity-50 whitespace-nowrap ${hidden ? 'bg-slate-700 text-gray-400 hover:text-white' : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'}`}
      title={hidden ? 'Aktuell im Menü versteckt - klicken zum Anzeigen' : 'Aktuell im Menü sichtbar - klicken zum Verstecken'}>
      {hidden ? '🚫 Versteckt' : '👁 Sichtbar'}
    </button>
  )
}

// ─── Ordered Dropdown Items Editor ───────────────────────────────────────────
function DropdownItemsEditor({ items, pages, onChange }: {
  items: string[]
  pages: { slug: string; title: string }[]
  onChange: (items: string[]) => void
}) {
  const moveItem = (i: number, dir: -1 | 1) => {
    const arr = [...items]
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    onChange(arr)
  }
  const removeItem = (slug: string) => onChange(items.filter(s => s !== slug))
  const addItem = (slug: string) => { if (!items.includes(slug)) onChange([...items, slug]) }

  const available = pages.filter(p => !items.includes(p.slug))

  return (
    <div className="space-y-2">
      {/* Active ordered items */}
      {items.length === 0 && (
        <p className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-xs text-gray-500 italic text-center">
          Noch keine Seiten hinzugefügt. Wähle unten eine Seite aus.
        </p>
      )}
      {items.map((slug, i) => {
        const page = pages.find(p => p.slug === slug)
        const isOrphan = !page
        return (
          <div key={slug}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm
              ${isOrphan ? 'border-yellow-500/30 bg-yellow-900/10' : 'border-green-500/20 bg-green-900/10'}`}>
            {/* Position badge */}
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-gray-300">
              {i + 1}
            </span>
            {/* Up/Down */}
            <div className="flex flex-col gap-0.5">
              <button onClick={() => moveItem(i, -1)} disabled={i === 0}
                className="flex h-4 w-5 items-center justify-center rounded text-gray-500 hover:bg-slate-700 hover:text-white disabled:opacity-20 transition text-xs leading-none">
                ▲
              </button>
              <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}
                className="flex h-4 w-5 items-center justify-center rounded text-gray-500 hover:bg-slate-700 hover:text-white disabled:opacity-20 transition text-xs leading-none">
                ▼
              </button>
            </div>
            {isOrphan ? (
              <>
                <span className="font-mono text-xs text-yellow-500">/{slug}</span>
                <span className="flex-1 text-xs text-yellow-500/70 italic">⚠ Seite nicht gefunden</span>
              </>
            ) : (
              <>
                <span className="font-mono text-xs text-gray-500 w-32 truncate">/{slug}</span>
                <span className="flex-1 truncate text-white font-medium">{page!.title}</span>
              </>
            )}
            <button onClick={() => removeItem(slug)}
              className="ml-auto flex-shrink-0 rounded px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-900/30 hover:text-red-300 transition">
              ✕
            </button>
          </div>
        )
      })}

      {/* Add from available pages */}
      {available.length > 0 && (
        <div className="pt-1">
          <label className="mb-1 block text-xs text-gray-500">Seite hinzufügen:</label>
          <div className="flex flex-wrap gap-1.5">
            {available.map(p => (
              <button key={p.slug} onClick={() => addItem(p.slug)}
                className="flex items-center gap-1 rounded-full border border-white/10 bg-slate-800 px-2.5 py-1 text-xs text-gray-400 hover:border-green-500/60 hover:bg-green-900/20 hover:text-green-400 transition">
                + <span className="font-mono">/{p.slug}</span> <span className="text-gray-500">– {p.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {available.length === 0 && items.length > 0 && (
        <p className="text-xs text-gray-600 italic pt-1">Alle verfügbaren Seiten sind bereits im Dropdown.</p>
      )}
    </div>
  )
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
  const moveGroup = (i: number, dir: -1 | 1) => {
    const arr = [...cfg.dropdowns]; const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    save({ ...cfg, dropdowns: arr })
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
  const moveFixedLink = (i: number, dir: -1 | 1) => {
    const arr = [...fixedLinks]; const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    saveFixedLinks(arr)
  }

  const createPageForSlug = async (slug: string, label: string) => {
    const title = label || slug
    await fetch(`${API_BASE}/api/pages`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, title }),
    })
    reloadPages()
  }

  // ─── Expanded state for dropdown groups ────────────────────────────────────
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set([0]))
  const toggleExpand = (i: number) => setExpandedGroups(prev => {
    const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n
  })

  return (
    <div className="space-y-4">

      {/* ═══ HEADER ══════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-white/10 bg-slate-800/40 px-5 py-4">
        <h3 className="text-base font-bold text-white">🗂 Navigation konfigurieren</h3>
        <p className="mt-1 text-xs text-gray-400">
          Lege Dropdown-Menüs und feste Links an. Menüpunkte können per <strong className="text-gray-300">Pfeil-Buttons</strong> in der gewünschten Reihenfolge sortiert werden.
        </p>
      </div>

      {/* ═══ FIXED: Startseite ══════════════════════════════════════════════ */}
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-gray-300">1</span>
        <span className="flex-1 text-sm font-medium text-white">Startseite</span>
        <span className="font-mono text-xs text-gray-500">/</span>
        <span className="rounded-full bg-slate-700 px-2.5 py-1 text-xs text-gray-500 border border-white/10">🔒 Immer sichtbar</span>
      </div>

      {/* ═══ DROPDOWN GROUPS ════════════════════════════════════════════════ */}
      {cfg.dropdowns.map((group, gi) => {
        const isExpanded = expandedGroups.has(gi)
        return (
          <div key={gi} className="rounded-xl border border-white/10 bg-slate-900/60 overflow-hidden">
            {/* Group header row */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              {/* Position number */}
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-gray-300">
                {gi + 2}
              </span>
              {/* Up/Down */}
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveGroup(gi, -1)} disabled={gi === 0}
                  className="flex h-4 w-5 items-center justify-center rounded text-gray-600 hover:bg-slate-700 hover:text-white disabled:opacity-20 transition text-xs">▲</button>
                <button onClick={() => moveGroup(gi, 1)} disabled={gi === cfg.dropdowns.length - 1}
                  className="flex h-4 w-5 items-center justify-center rounded text-gray-600 hover:bg-slate-700 hover:text-white disabled:opacity-20 transition text-xs">▼</button>
              </div>
              {/* Label */}
              <div className="flex flex-1 items-center gap-2 min-w-0">
                <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-gray-400">Dropdown</span>
                <span className="font-medium text-white truncate">{group.label || <em className="text-gray-500">Kein Name</em>}</span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-800 px-2 py-0.5 text-xs text-gray-500">
                  {group.items.length} Eintr.
                </span>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggleExpand(gi)}
                  className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-gray-400 hover:text-white hover:border-white/30 transition">
                  {isExpanded ? '▲ Einklappen' : '▼ Bearbeiten'}
                </button>
                <button onClick={() => removeGroup(gi)}
                  className="rounded-lg border border-red-500/20 bg-red-900/10 px-2.5 py-1 text-xs text-red-400 hover:bg-red-900/30 transition">
                  Entfernen
                </button>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="p-4 space-y-4">
                {/* Name */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-300">Anzeigename</label>
                    <input value={group.label} onChange={e => updateGroup(gi, { label: e.target.value })}
                      placeholder="z. B. Über uns"
                      className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-green-500 focus:outline-none" />
                  </div>
                  <VisibilitySelect value={group.visibility} onChange={v => updateGroup(gi, { visibility: v })} />
                </div>

                {/* Click behaviour */}
                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-300">Klick-Verhalten auf den Namen</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => updateGroup(gi, { target: undefined })}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition
                        ${!group.target ? 'border-green-500 bg-green-900/20 text-green-400' : 'border-white/10 bg-slate-800 text-gray-400 hover:border-white/30 hover:text-white'}`}>
                      ▾ Nur Dropdown öffnen
                    </button>
                    <button type="button" onClick={() => updateGroup(gi, { target: group.target || pages[0]?.slug || '' })}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition
                        ${group.target ? 'border-blue-500 bg-blue-900/20 text-blue-400' : 'border-white/10 bg-slate-800 text-gray-400 hover:border-white/30 hover:text-white'}`}>
                      🔗 Auf Seite weiterleiten
                    </button>
                  </div>
                  {group.target && (
                    <div className="mt-2">
                      <label className="mb-1 block text-xs text-gray-400">Zielseite</label>
                      <select value={group.target} onChange={e => updateGroup(gi, { target: e.target.value || undefined })}
                        className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none">
                        <option value="">— Seite auswählen —</option>
                        {pages.map(p => <option key={p.slug} value={p.slug}>/{p.slug} – {p.title}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* Items ordered list */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <label className="text-xs font-semibold text-gray-300">Menüpunkte (Reihenfolge)</label>
                    <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-gray-500">{group.items.length}</span>
                  </div>
                  <DropdownItemsEditor
                    items={group.items}
                    pages={pages}
                    onChange={items => updateGroup(gi, { items })}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}

      <button onClick={addGroup}
        className="w-full rounded-xl border border-dashed border-white/20 py-3 text-sm font-medium text-gray-400 hover:border-green-500/60 hover:text-green-400 transition">
        + Neues Dropdown-Menü hinzufügen
      </button>

      {/* ═══ FESTE LINKS ════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-900/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-blue-500/10">
          <div>
            <p className="text-sm font-bold text-blue-300">🔗 Feste Links</p>
            <p className="mt-0.5 text-xs text-gray-500">Eigenständige Links ohne Dropdown – z.&nbsp;B. „Intern" nur für Mitglieder.</p>
          </div>
          <button onClick={addFixedLink} className="rounded-lg border border-blue-500/30 bg-blue-900/20 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-800/40 transition">
            + Festen Link
          </button>
        </div>

        <div className="p-4 space-y-3">
          {fixedLinks.length === 0 && <p className="text-xs text-gray-600 italic">Keine festen Links konfiguriert.</p>}
          {fixedLinks.map((link, li) => (
            <div key={li} className="rounded-lg border border-white/10 bg-slate-900/60 overflow-hidden">
              {/* Header row */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveFixedLink(li, -1)} disabled={li === 0}
                    className="flex h-4 w-5 items-center justify-center rounded text-gray-600 hover:bg-slate-700 hover:text-white disabled:opacity-20 transition text-xs">▲</button>
                  <button onClick={() => moveFixedLink(li, 1)} disabled={li === fixedLinks.length - 1}
                    className="flex h-4 w-5 items-center justify-center rounded text-gray-600 hover:bg-slate-700 hover:text-white disabled:opacity-20 transition text-xs">▼</button>
                </div>
                <span className="flex-1 font-medium text-blue-200">{link.label || <em className="text-gray-500">Kein Name</em>}</span>
                <span className="font-mono text-xs text-gray-500">{link.href}</span>
                <button onClick={() => removeFixedLink(li)} className="rounded px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-900/30 transition">✕</button>
              </div>

              {/* Detail form */}
              <div className="p-3 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <div className="flex-1 min-w-[150px]">
                    <label className="mb-1 block text-xs text-gray-400">Anzeigename</label>
                    <input value={link.label} onChange={e => updateFixedLink(li, { label: e.target.value })}
                      className="w-full rounded-lg border border-white/10 bg-slate-800 px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none" />
                  </div>
                  <div className="flex-1 min-w-[150px]">
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
                        className="rounded-lg border border-white/10 bg-slate-800 px-2 py-1.5 text-xs text-gray-400 focus:border-blue-500 focus:outline-none max-w-[100px]">
                        <option value="">📄 Seite…</option>
                        {pages.map(p => <option key={p.slug} value={p.slug}>/{p.slug}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* CMS page status */}
                {(() => {
                  const linkSlug = link.href.replace(/^\//, '')
                  const linkedPage = linkSlug ? pages.find(p => p.slug === linkSlug) : null
                  if (!linkSlug || link.href === '/') return null
                  return linkedPage
                    ? <p className="text-xs text-green-500/70">✓ CMS-Seite „{linkedPage.title}" verknüpft</p>
                    : <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-yellow-500/60">⚠ Keine CMS-Seite für <span className="font-mono">{link.href}</span></p>
                        <button type="button" onClick={() => createPageForSlug(linkSlug, link.label)}
                          className="rounded bg-yellow-700/40 border border-yellow-500/30 px-2 py-0.5 text-xs text-yellow-300 hover:bg-yellow-600/50 transition">
                          + Seite anlegen
                        </button>
                      </div>
                })()}

                <VisibilitySelect value={link.visibility} onChange={v => updateFixedLink(li, { visibility: v })} />

                {/* Sub-Items */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 mt-1">
                    <label className="text-xs text-gray-400 font-medium">Untermenü-Links</label>
                    <button onClick={() => updateFixedLink(li, { items: [...(link.items ?? []), { label: 'Neuer Link', href: '/' }] })}
                      className="text-xs text-blue-400 hover:text-blue-300 transition">+ Sub-Link</button>
                  </div>
                  {(link.items ?? []).length === 0 && (
                    <p className="text-xs text-gray-600 italic">Keine Sub-Links.</p>
                  )}
                  <div className="space-y-1.5">
                    {(link.items ?? []).map((sub, si) => {
                      const updateSub = (patch: Partial<{ label: string; href: string }>) =>
                        updateFixedLink(li, { items: (link.items ?? []).map((s, idx) => idx === si ? { ...s, ...patch } : s) })
                      const subSlug = sub.href.replace(/^\//, '')
                      const linkedPage = pages.find(p => p.slug === subSlug)
                      return (
                        <div key={si} className="rounded-lg border border-white/10 bg-slate-800/60 p-2 space-y-1.5">
                          <div className="flex gap-2 items-center">
                            <input value={sub.label} onChange={e => updateSub({ label: e.target.value })}
                              placeholder="Label"
                              className="flex-1 rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none" />
                            <select value={linkedPage ? subSlug : ''}
                              onChange={e => {
                                if (!e.target.value) return
                                const p = pages.find(pg => pg.slug === e.target.value)
                                if (p) updateSub({ href: `/${p.slug}`, label: sub.label || p.title })
                              }}
                              className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-gray-300 focus:border-blue-500 focus:outline-none max-w-[130px]">
                              <option value="">📄 Seite wählen…</option>
                              {pages.map(p => <option key={p.slug} value={p.slug}>/{p.slug}</option>)}
                            </select>
                            <input value={sub.href} onChange={e => updateSub({ href: e.target.value })}
                              placeholder="/pfad"
                              className="w-28 rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white font-mono focus:border-blue-500 focus:outline-none" />
                            <button onClick={() => updateFixedLink(li, { items: (link.items ?? []).filter((_, idx) => idx !== si) })}
                              className="text-xs text-red-400 hover:text-red-300 px-1 flex-shrink-0">✕</button>
                          </div>
                          {linkedPage
                            ? <p className="text-xs text-green-500/80">✓ „{linkedPage.title}" verknüpft</p>
                            : sub.href && sub.href !== '/'
                              ? <div className="flex items-center gap-2">
                                  <p className="text-xs text-yellow-500/70">⚠ Keine CMS-Seite für <span className="font-mono">{sub.href}</span></p>
                                  <button type="button" onClick={() => createPageForSlug(subSlug, sub.label)}
                                    className="rounded bg-yellow-700/40 border border-yellow-500/30 px-2 py-0.5 text-xs text-yellow-300 hover:bg-yellow-600/50 transition">
                                    + Anlegen
                                  </button>
                                </div>
                              : null
                          }
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ HIDDEN PAGES ═══════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-red-500/20 bg-red-900/10 overflow-hidden">
        <div className="px-5 py-3 border-b border-red-500/10">
          <p className="text-sm font-bold text-red-300">🚫 Einzelseiten ausblenden</p>
          <p className="mt-0.5 text-xs text-gray-500">Seiten ohne Dropdown erscheinen als eigenständiger Link – hier kannst du einzelne davon verstecken.</p>
        </div>
        <div className="p-4">
          {(() => {
            const visiblePages = pages.filter(p => !inDropdown.has(p.slug))
            const orphanedHidden = Array.from(hiddenSet).filter(slug => !pages.find(p => p.slug === slug) && !inDropdown.has(slug))
            if (visiblePages.length === 0 && orphanedHidden.length === 0)
              return <p className="text-xs text-gray-500 italic">Alle Seiten sind in Dropdowns vergeben.</p>
            return (
              <div className="flex flex-col divide-y divide-white/5 rounded-lg border border-white/10 overflow-hidden">
                {orphanedHidden.map(slug => (
                  <button key={`orphan-hidden-${slug}`} type="button" onClick={() => toggleHidden(slug)}
                    className="flex items-center gap-3 px-3 py-2.5 text-left text-sm transition bg-yellow-900/20 text-yellow-400 hover:bg-yellow-900/40">
                    <span className="h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 bg-yellow-500 border-yellow-500">
                      <span className="text-white text-xs">✓</span>
                    </span>
                    <span className="font-mono text-xs w-28 truncate">/{slug}</span>
                    <span className="flex-1 italic text-yellow-500/70 text-xs">⚠ Seite nicht gefunden – klicken zum Entfernen</span>
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
                      <span className={`text-xs ${isHidden ? 'text-red-400/70' : 'text-gray-600'}`}>
                        {isHidden ? 'ausgeblendet' : '→ eigenständiger Link'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ─── Page Editor ──────────────────────────────────────────────────────────────
/** Macht eine SectionEditor-Karte per @dnd-kit sortierbar; der eigentliche Drag-Griff
 *  ist der ⠿-Button in SectionEditors Kopfzeile, damit man nicht versehentlich beim
 *  Klicken in ein Formularfeld eine Section verschiebt. */
function SortableSectionItem({ id, children }: { id: string; children: (dragHandleProps: React.HTMLAttributes<HTMLButtonElement>) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>)}
    </div>
  )
}

function PageEditor({ page, onBack }: { page: PageMeta; onBack: () => void }) {
  const { showToast } = useToast()
  const [sections, setSections] = useState<SectionResponse[]>(page.sections.sort((a, b) => a.position - b.position))
  const [addType, setAddType] = useState('HERO')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const reload = async () => {
    const res = await fetch(`${API_BASE}/api/pages/${page.slug}`)
    if (res.ok) { const p = await res.json(); setSections(p.sections.sort((a: SectionResponse, b: SectionResponse) => a.position - b.position)) }
  }

  const persistOrder = async (ordered: SectionResponse[]) => {
    setSections(ordered)
    try {
      await Promise.all(ordered.map((s, i) =>
        fetch(`${API_BASE}/api/pages/${page.slug}/sections/${s.id}`, {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: s.type, position: i + 1, content: s.content }),
        })
      ))
      showToast('Reihenfolge gespeichert.', 'success')
    } catch {
      showToast('Reihenfolge konnte nicht gespeichert werden.', 'error')
    }
  }

  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= sections.length) return
    const reordered = [...sections]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    persistOrder(reordered)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sections.findIndex(s => s.id === active.id)
    const newIndex = sections.findIndex(s => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    persistOrder(arrayMove(sections, oldIndex, newIndex))
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
      : addType === 'TERMINE_KONZERTE' ? { heading: 'Konzerte & Veranstaltungen', maxItems: 6 }
      : addType === 'INTERN_CHANGELOG' ? { heading: 'Was ist neu?', entries: [] }
      : addType === 'IMAGE_TEXT' ? { heading: 'Überschrift', markdown: 'Text hier…', imageUrl: '', imagePosition: 'left' }
      : addType === 'CTA_BUTTON' ? { heading: 'Überschrift', text: '', buttonLabel: 'Jetzt anmelden', buttonHref: '/' }
      : addType === 'FAQ' ? { heading: 'Häufige Fragen', items: [{ question: 'Neue Frage', answer: '' }] }
      : addType === 'SPACER' ? { size: 'md', showLine: false }
      : addType === 'QUOTE' ? { quote: 'Zitat hier…', author: '', role: '' }
      : addType === 'STATS' ? { heading: 'Zahlen & Fakten', items: [{ value: '100+', label: 'Mitglieder' }] }
      : addType === 'VIDEO_EMBED' ? { heading: '', videoUrl: '', caption: '' }
      : { heading: 'Überschrift', markdown: 'Inhalt hier...' }
    const res = await fetch(`${API_BASE}/api/pages/${page.slug}/sections`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: addType, position: sections.length + 1, content: defaultContent }),
    })
    if (res.ok) showToast('Sektion hinzugefügt.', 'success')
    else showToast('Sektion konnte nicht hinzugefügt werden.', 'error')
    reload()
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm mb-6">
        <button onClick={onBack} className="text-gray-500 hover:text-white transition">📄 Seiten</button>
        <span className="text-gray-600">/</span>
        <span className="text-white font-medium">{page.title}</span>
        <span className="rounded-full bg-slate-800 border border-white/10 px-2 py-0.5 text-[10px] text-gray-500">wird bearbeitet</span>
        <span className="ml-auto text-xs font-mono text-gray-600">/{page.slug}</span>
      </div>
      <div className="flex flex-col gap-4 mb-6">
        {sections.length === 0 && <p className="text-sm text-gray-500">Keine Sektionen vorhanden.</p>}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {sections.map((s, i) => (
              <SortableSectionItem key={s.id} id={s.id}>
                {dragHandleProps => (
                  <SectionEditor
                    section={s} pageSlug={page.slug} onSaved={reload} onDeleted={reload}
                    dragHandleProps={dragHandleProps}
                    onMoveUp={() => moveSection(i, -1)} onMoveDown={() => moveSection(i, 1)}
                    canMoveUp={i > 0} canMoveDown={i < sections.length - 1}
                  />
                )}
              </SortableSectionItem>
            ))}
          </SortableContext>
        </DndContext>
      </div>
      <div className="flex gap-3 items-center border-t border-white/10 pt-5">
        <select value={addType} onChange={e => setAddType(e.target.value)}
          className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none">
          {Object.keys(SECTION_TYPE_INFO).map(t => (
            <option key={t} value={t}>{sectionTypeInfo(t).icon} {sectionTypeInfo(t).label}</option>
          ))}
        </select>
        <button type="button" onClick={addSection} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition">
          + Sektion hinzufügen
        </button>
      </div>
      <p className="mt-1.5 text-xs text-gray-500">{sectionTypeInfo(addType).hint}</p>
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

  // Copy
  const [showCopyFilesModal, setShowCopyFilesModal] = useState(false)
  const [copyFolderSource, setCopyFolderSource] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const [overwriteState, setOverwriteState] = useState<{
    conflictCount: number; totalCount: number; action: () => void
  } | null>(null)
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
    // Rekursiv ALLE Dateien im Ordner holen (nicht nur direkte)
    const res = await fetch(`${API_BASE}/api/admin/assets?prefix=${encodeURIComponent(oldFolderPrefix)}&recursive=true`, { credentials: 'include' })
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
    let errors = 0
    for (const oldKey of selectedKeys) {
      const filename = oldKey.split('/').pop() ?? oldKey
      const newKey = targetPrefix + filename
      if (newKey !== oldKey) {
        const res = await fetch(`${API_BASE}/api/admin/assets/rename`, { method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldKey, newKey }) })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          console.error('Rename fehlgeschlagen:', oldKey, '→', newKey, err)
          errors++
        }
      }
    }
    setSelectedKeys(new Set())
    setMoving(false)
    if (errors > 0) alert(`⚠️ ${errors} Datei(en) konnten nicht verschoben werden. Details in der Browser-Konsole.`)
    load(prefix)
  }

  // ── Copy handlers ────────────────────────────────────────────────────────────
  const doCopyFiles = async (targetFolder: string, overwrite: boolean) => {
    setCopying(true)
    const targetPrefix = targetFolder ? targetFolder.replace(/\/$/, '') + '/' : ''
    const conflicts: string[] = []
    for (const oldKey of selectedKeys) {
      const filename = oldKey.split('/').pop() ?? oldKey
      const newKey = targetPrefix + filename
      const res = await fetch(`${API_BASE}/api/admin/assets/copy`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldKey, newKey, overwrite })
      })
      if (res.status === 409) conflicts.push(newKey)
    }
    setCopying(false)
    if (conflicts.length > 0 && !overwrite) {
      setOverwriteState({
        conflictCount: conflicts.length,
        totalCount: selectedKeys.size,
        action: () => { setOverwriteState(null); doCopyFiles(targetFolder, true) }
      })
    } else {
      setShowCopyFilesModal(false)
      load(prefix)
    }
  }

  const doCopyFolder = async (sourcePrefix: string, targetFolder: string, overwrite: boolean) => {
    setCopying(true)
    const folderName = sourcePrefix.replace(/\/$/, '').split('/').pop() ?? 'kopie'
    const targetPrefix = (targetFolder ? targetFolder.replace(/\/$/, '') + '/' : '') + folderName + '/'
    const res = await fetch(`${API_BASE}/api/admin/assets/copy-folder`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePrefix, targetPrefix, overwrite })
    })
    setCopying(false)
    if (res.status === 409 && !overwrite) {
      const data = await res.json()
      const conflictCount = (data.conflicts as string[]).length
      setOverwriteState({
        conflictCount,
        totalCount: conflictCount,
        action: () => { setOverwriteState(null); doCopyFolder(sourcePrefix, targetFolder, true) }
      })
    } else {
      setCopyFolderSource(null)
      load(prefix)
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

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
          <button onClick={() => setShowMoveModal(true)} disabled={moving || copying}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition">
            {moving ? 'Verschiebe…' : '📁 Verschieben nach…'}
          </button>
          <button onClick={() => setShowCopyFilesModal(true)} disabled={moving || copying}
            className="rounded-lg bg-slate-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-500 disabled:opacity-50 transition">
            {copying ? 'Kopiere…' : '📋 Kopieren nach…'}
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
                          <button onClick={() => { setCopyFolderSource(f) }} title="Kopieren"
                            className="rounded p-1 text-gray-500 hover:text-blue-400 transition text-xs">📋</button>
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
                          <button onClick={() => { setSelectedKeys(new Set([a.key])); setShowCopyFilesModal(true) }}
                            className="rounded px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-gray-300 transition">📋 Kopieren</button>
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

      {/* Copy-Dateien-Modal */}
      {showCopyFilesModal && (
        <MoveFolderPickerModal
          count={selectedKeys.size}
          title={`📋 ${selectedKeys.size} Datei(en) kopieren nach…`}
          onSelect={folder => doCopyFiles(folder, false)}
          onClose={() => setShowCopyFilesModal(false)}
        />
      )}

      {/* Copy-Ordner-Modal */}
      {copyFolderSource && (
        <MoveFolderPickerModal
          count={1}
          title={`📋 Ordner „${copyFolderSource.replace(/\/$/, '').split('/').pop()}" kopieren nach…`}
          onSelect={folder => doCopyFolder(copyFolderSource, folder, false)}
          onClose={() => setCopyFolderSource(null)}
        />
      )}

      {/* Überschreiben-Bestätigung */}
      {overwriteState && (
        <OverwriteConfirmModal
          conflictCount={overwriteState.conflictCount}
          totalCount={overwriteState.totalCount}
          onConfirm={overwriteState.action}
          onCancel={() => setOverwriteState(null)}
        />
      )}
    </div>
  )
}

// ─── Overwrite Confirm Modal ───────────────────────────────────────────────────
function OverwriteConfirmModal({ conflictCount, totalCount, onConfirm, onCancel }: {
  conflictCount: number; totalCount: number; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-yellow-500/30 bg-slate-900 shadow-2xl p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl">⚠️</span>
          <div>
            <h3 className="font-bold text-white">Dateien bereits vorhanden</h3>
            <p className="text-sm text-gray-400 mt-0.5">
              {conflictCount === totalCount
                ? `Alle ${conflictCount} Datei${conflictCount !== 1 ? 'en' : ''} exist${conflictCount !== 1 ? 'ieren' : 'iert'} am Ziel bereits.`
                : `${conflictCount} von ${totalCount} Datei${totalCount !== 1 ? 'en' : ''} exist${conflictCount !== 1 ? 'ieren' : 'iert'} am Ziel bereits.`}
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-300">Vorhandene Dateien überschreiben?</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-400 hover:text-white transition">
            Abbrechen
          </button>
          <button onClick={onConfirm}
            className="flex-1 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-500 transition">
            Überschreiben
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Move Folder Picker ────────────────────────────────────────────────────────
function MoveFolderPickerModal({ count, onSelect, onClose, title }: {
  count: number; onSelect: (folder: string) => void; onClose: () => void; title?: string
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
          <h3 className="font-bold text-white">{title ?? `📁 ${count} Datei(en) verschieben nach…`}</h3>
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

// ─── Videos Manager ───────────────────────────────────────────────────────────

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

function VideosManager() {
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

// ─── Meldungen Editor ─────────────────────────────────────────────────────────
interface MeldungItem { id: string; title: string; text: string; body: string; imageUrl?: string; style: 'info' | 'warning' | 'success'; activeForBanner: boolean; validFrom?: string; validUntil?: string }

function parseDMY(s: string): Date { const p = s.split('.'); return new Date(+p[2], +p[1] - 1, +p[0]) }
function meldungScheduleStatus(m: MeldungItem): 'scheduled-active' | 'scheduled-future' | 'scheduled-expired' | 'manual-active' | 'inactive' {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (m.validFrom || m.validUntil) {
    const from  = m.validFrom  ? parseDMY(m.validFrom)  : null
    const until = m.validUntil ? parseDMY(m.validUntil) : null
    if (from && from > today) return 'scheduled-future'
    if (until && until < today) return 'scheduled-expired'
    return 'scheduled-active'
  }
  return m.activeForBanner ? 'manual-active' : 'inactive'
}

const MELDUNG_STYLE_COLORS: Record<string, { label: string; dot: string }> = {
  info:    { label: 'Blau (Info)',   dot: 'bg-blue-500' },
  warning: { label: 'Amber (Warnung)', dot: 'bg-amber-500' },
  success: { label: 'Grün (Erfolg)', dot: 'bg-green-500' },
}

function MeldungenEditor() {
  const [meldungen, setMeldungen] = useState<MeldungItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/site/settings`)
      .then(r => r.json())
      .then((data: Record<string, string>) => {
        if (data.meldungen) {
          try { setMeldungen(JSON.parse(data.meldungen)) } catch { /* ignore */ }
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async (list: MeldungItem[]) => {
    setSaving(true)
    await fetch(`${API_BASE}/api/site/meldungen`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: JSON.stringify(list) }),
    })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const update = (id: string, patch: Partial<MeldungItem>) => {
    setMeldungen(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))
  }

  const addNew = () => {
    const newM: MeldungItem = { id: crypto.randomUUID(), title: 'Neue Meldung', text: '', body: '', imageUrl: '', style: 'warning', activeForBanner: false, validFrom: undefined, validUntil: undefined }
    setMeldungen(prev => [newM, ...prev])
    setExpanded(newM.id)
  }

  const remove = (id: string) => {
    if (!confirm('Meldung wirklich löschen?')) return
    setMeldungen(prev => prev.filter(m => m.id !== id))
  }

  const toggleBanner = (id: string) => {
    setMeldungen(prev => prev.map(m => ({ ...m, activeForBanner: m.id === id ? !m.activeForBanner : false })))
  }

  if (loading) return <p className="text-gray-400 text-sm py-4">Lade Meldungen…</p>

  return (
    <div className="space-y-4">
      {/* Header + Add */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">
            Erstelle Info-Meldungen. Eine kann als Banner oben aktiviert werden – andere lassen sich mit abgesagten Terminen verknüpfen.
          </p>
        </div>
        <button onClick={addNew}
          className="shrink-0 rounded-lg border border-dashed border-green-500/40 bg-green-900/10 px-3 py-1.5 text-xs text-green-400 hover:bg-green-900/20 transition">
          + Neue Meldung
        </button>
      </div>

      {meldungen.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 py-10 text-center">
          <p className="text-sm text-gray-500">Noch keine Meldungen.</p>
          <button onClick={addNew} className="mt-3 text-sm text-green-400 hover:text-green-300 transition">
            + Erste Meldung erstellen
          </button>
        </div>
      )}

      {meldungen.map(m => {
        const isOpen = expanded === m.id
        const colorDot = MELDUNG_STYLE_COLORS[m.style]?.dot ?? 'bg-gray-500'
        const status = meldungScheduleStatus(m)
        const STATUS_CFG = {
          'scheduled-active':  { label: '🟢 Aktiv (Zeitplan)',   cls: 'bg-green-500/15 border-green-500/30 text-green-400',  cardCls: 'border-green-500/30 bg-green-900/5' },
          'scheduled-future':  { label: `🔵 Geplant ab ${m.validFrom}`, cls: 'bg-blue-500/15 border-blue-500/30 text-blue-400',  cardCls: 'border-blue-500/20 bg-blue-900/5' },
          'scheduled-expired': { label: '⚪ Abgelaufen',          cls: 'bg-white/5 border-white/10 text-gray-600',             cardCls: 'border-white/8 bg-slate-900 opacity-60' },
          'manual-active':     { label: '✋ Manuell aktiv',       cls: 'bg-amber-500/15 border-amber-500/30 text-amber-400',   cardCls: 'border-amber-500/30 bg-amber-900/10' },
          'inactive':          { label: '',                        cls: '',                                                      cardCls: 'border-white/10 bg-slate-900' },
        } as const
        const sCfg = STATUS_CFG[status]
        return (
          <div key={m.id} className={`rounded-xl border overflow-hidden transition ${sCfg.cardCls}`}>
            {/* Row header */}
            <div className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => toggleBanner(m.id)} title="Manuell als Banner aktivieren"
                className={`shrink-0 flex h-5 w-9 rounded-full transition ${status === 'manual-active' ? 'bg-amber-500' : 'bg-slate-700'}`}>
                <div className={`m-0.5 h-4 w-4 rounded-full bg-white transition-transform ${status === 'manual-active' ? 'translate-x-4' : ''}`} />
              </button>
              <span className={`h-2 w-2 rounded-full shrink-0 ${colorDot}`} />
              <span className="flex-1 truncate text-sm font-medium text-white">
                {m.title || <span className="text-gray-500 italic">Ohne Titel</span>}
              </span>
              {sCfg.label && (
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold shrink-0 ${sCfg.cls}`}>
                  {sCfg.label}
                </span>
              )}
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => setExpanded(isOpen ? null : m.id)}
                  className="rounded px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-white transition">
                  {isOpen ? '▲ Einklappen' : '▼ Bearbeiten'}
                </button>
                <button onClick={() => remove(m.id)}
                  className="rounded px-2 py-1 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 transition">✕</button>
              </div>
            </div>

            {/* Edit form */}
            {isOpen && (
              <div className="border-t border-white/10 p-4 flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">Titel <span className="text-gray-600">(nur intern – zur Unterscheidung)</span></label>
                    <input value={m.title} onChange={e => update(m.id, { title: e.target.value })}
                      placeholder="z.B. Sommerkonzert 2026 abgesagt"
                      className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-green-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">Farbe</label>
                    <div className="flex gap-2 pt-0.5">
                      {(Object.entries(MELDUNG_STYLE_COLORS) as [string, { label: string; dot: string }][]).map(([v, c]) => (
                        <button key={v} onClick={() => update(m.id, { style: v as MeldungItem['style'] })}
                          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                            m.style === v ? 'border-green-500/40 bg-green-900/30 text-green-400' : 'border-white/10 bg-slate-800 text-gray-400 hover:text-white'
                          }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">Kurztext <span className="text-gray-600">(im Banner + Popup-Header)</span></label>
                  <input value={m.text} onChange={e => update(m.id, { text: e.target.value })}
                    placeholder="z.B. Das Sommerkonzert 2026 fällt leider aus."
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-green-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">Beitragstext <span className="text-gray-600">(optional – erscheint im Popup)</span></label>
                  <textarea value={m.body} onChange={e => update(m.id, { body: e.target.value })}
                    rows={4} placeholder="Ausführliche Infos, Hintergründe, Alternativen..."
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white resize-y focus:border-green-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">Bild im Popup <span className="text-gray-600">(optional – erscheint über dem Text)</span></label>
                  <ImageField label="" value={m.imageUrl ?? ''} onChange={v => update(m.id, { imageUrl: v })} />
                </div>
                {/* Zeitplan */}
                <div className="rounded-lg border border-white/8 bg-slate-800/50 p-3 flex flex-col gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    🗓 Zeitplan <span className="normal-case font-normal text-gray-600">(optional – Banner erscheint automatisch im angegebenen Zeitraum)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">Von</label>
                      <input type="text" value={m.validFrom ?? ''} onChange={e => update(m.id, { validFrom: e.target.value || undefined })}
                        placeholder="dd.MM.yyyy"
                        className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:border-green-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">Bis (inkl.)</label>
                      <input type="text" value={m.validUntil ?? ''} onChange={e => update(m.id, { validUntil: e.target.value || undefined })}
                        placeholder="dd.MM.yyyy"
                        className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:border-green-500 focus:outline-none" />
                    </div>
                  </div>
                  {(m.validFrom || m.validUntil) && (
                    <button onClick={() => update(m.id, { validFrom: undefined, validUntil: undefined, activeForBanner: false })}
                      className="self-start text-[11px] text-red-400/70 hover:text-red-400 transition">
                      ✕ Zeitplan entfernen
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                  <label className={`flex items-center gap-2 cursor-pointer ${m.validFrom || m.validUntil ? 'opacity-40 pointer-events-none' : ''}`}>
                    <div onClick={() => toggleBanner(m.id)}
                      className={`relative h-5 w-9 rounded-full transition ${m.activeForBanner && !m.validFrom && !m.validUntil ? 'bg-amber-500' : 'bg-slate-700'}`}>
                      <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${m.activeForBanner && !m.validFrom && !m.validUntil ? 'translate-x-4' : ''}`} />
                    </div>
                    <span className="text-xs text-gray-400">Manuell als Banner aktivieren <span className="text-gray-600">(deaktiviert andere; wird durch Zeitplan überschrieben)</span></span>
                  </label>
                  <p className="ml-auto text-[10px] text-gray-600 font-mono truncate">ID: {m.id.slice(0, 8)}…</p>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {meldungen.length > 0 && (
        <button onClick={() => save(meldungen)} disabled={saving}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">
          {saving ? 'Speichert…' : saved ? '✓ Gespeichert!' : '✓ Alle Meldungen speichern'}
        </button>
      )}
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
  const [folderPickerTarget, setFolderPickerTarget] = useState<'noten_prefix' | 'galerie_intern_prefix'>('noten_prefix')
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
    <div className="space-y-6">
      {showFolderPicker && (
        <R2FolderPickerModal
          onSelect={v => setSettings({ ...settings, [folderPickerTarget]: v })}
          onClose={() => setShowFolderPicker(false)}
        />
      )}

      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4">
          <h3 className="text-sm font-bold text-white">🖼 Website-Darstellung</h3>
        </div>
        <div className="p-5">
          <ImageField
            label="Logo (Navbar)"
            value={settings.logo_url || ''}
            onChange={(v) => setSettings({ ...settings, logo_url: v })}
          />
        </div>
      </div>

      {/* ── Noten ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4">
          <h3 className="text-sm font-bold text-white">🎼 Noten-Einstellungen</h3>
          <p className="mt-0.5 text-xs text-gray-400">Der R2-Ordner, aus dem die Noten-Seite für alle Mitglieder lädt.</p>
        </div>
        <div className="p-5">
          <label className="mb-1 block text-xs text-gray-400">Noten-Ordner (R2-Präfix)</label>
          <div className="flex gap-2 items-center">
            <input
              value={settings.noten_prefix || ''}
              onChange={e => setSettings({ ...settings, noten_prefix: e.target.value })}
              placeholder="z.B. Noten/"
              className="flex-1 rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-white font-mono focus:border-green-500 focus:outline-none"
            />
            <button onClick={() => { setFolderPickerTarget('noten_prefix'); setShowFolderPicker(true) }}
              className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-slate-600 transition whitespace-nowrap">
              📁 R2 wählen
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Aktuell: <span className="font-mono text-green-400">{settings.noten_prefix || '(nicht gesetzt – Root)'}</span>
          </p>
        </div>
      </div>

      {/* ── Interne Galerie ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4">
          <h3 className="text-sm font-bold text-white">🖼️ Interne Galerie</h3>
          <p className="mt-0.5 text-xs text-gray-400">
            Der R2-Ordner, aus dem die interne Galerie (nur für angemeldete Mitglieder) lädt.
            Solange hier nichts eingetragen ist, zeigt die Seite einen Hinweis, dass noch nichts hinterlegt wurde.
          </p>
        </div>
        <div className="p-5">
          <label className="mb-1 block text-xs text-gray-400">Interne-Galerie-Ordner (R2-Präfix)</label>
          <div className="flex gap-2 items-center">
            <input
              value={settings.galerie_intern_prefix || ''}
              onChange={e => setSettings({ ...settings, galerie_intern_prefix: e.target.value })}
              placeholder="z.B. galerie-intern/"
              className="flex-1 rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-white font-mono focus:border-green-500 focus:outline-none"
            />
            <button onClick={() => { setFolderPickerTarget('galerie_intern_prefix'); setShowFolderPicker(true) }}
              className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-slate-600 transition whitespace-nowrap">
              📁 R2 wählen
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Aktuell: <span className="font-mono text-green-400">{settings.galerie_intern_prefix || '(nicht gesetzt – Galerie zeigt "Noch nichts hinterlegt")'}</span>
          </p>
        </div>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4">
          <h3 className="text-sm font-bold text-white">🗂 Navigation</h3>
          <p className="mt-0.5 text-xs text-gray-400">Dropdown-Menüs, feste Links und Sichtbarkeitsregeln konfigurieren.</p>
        </div>
        <div className="p-5">
          <NavConfigEditor settings={settings} setSettings={setSettings} allPages={allPages} reloadPages={reloadPages} />
        </div>
      </div>

      {/* ── Save button ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button onClick={saveSettings} disabled={saving}
          className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">
          {saving ? 'Speichert…' : saved ? '✓ Gespeichert!' : '✓ Einstellungen speichern'}
        </button>
        {saved && <span className="text-xs text-green-400">Alle Änderungen wurden gespeichert.</span>}
      </div>
    </div>
  )
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, loading } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()
  const [tab, setTab] = useState<'pages' | 'assets' | 'meldungen' | 'settings' | 'members' | 'videos' | 'preisgruppen' | 'antraege' | 'kalender'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin_tab')
      if (['assets', 'meldungen', 'settings', 'members', 'videos', 'preisgruppen', 'antraege', 'kalender'].includes(saved ?? '')) return saved as any
    }
    return 'pages'
  })

  // Dark mode is enforced by admin/layout.tsx — no useEffect needed here
  // For BOARD users, default to members tab (set after user loads)
  const [boardTabInit, setBoardTabInit] = useState(false)
  const [docsOpen, setDocsOpen] = useState(false)
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
  interface Gruppe { id: string; wochentag: string; vonUhrzeit: string; bisUhrzeit: string; location?: { id: string; name: string; adresse: string }; priceGroup?: { id: string; name: string } }
  interface Loc { id: string; name: string; adresse: string; parkplatzInfo?: string }
  const [gruppen, setGruppen] = useState<Gruppe[]>([])
  const [locations, setLocations] = useState<Loc[]>([])
  const [gruppenMsg, setGruppenMsg] = useState('')
  const [newGruppe, setNewGruppe] = useState({ locationId: '', vonUhrzeit: '', bisUhrzeit: '', wochentag: '', priceGroupId: '' })
  const [newLocation, setNewLocation] = useState({ name: '', adresse: '', parkplatzInfo: '' })
  const [parkplatzDraft, setParkplatzDraft] = useState<Record<string, string>>({})

  // Preisgruppen
  interface PriceRate { id: string; amountCents: number; validFrom: string; createdAt: string }
  interface PriceGroup { id: string; name: string; description: string | null; currentRate?: PriceRate }
  const [priceGroups, setPriceGroups] = useState<PriceGroup[]>([])
  const [priceGroupsMsg, setPriceGroupsMsg] = useState('')
  const [newPriceGroup, setNewPriceGroup] = useState({ name: '', description: '' })
  const [rateHistory, setRateHistory] = useState<Record<string, PriceRate[]>>({})
  const [newRate, setNewRate] = useState<Record<string, { amountEuro: string; validFrom: string }>>({})

  const loadPriceGroups = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/pricing/groups`, { credentials: 'include' })
    if (res.ok) setPriceGroups(await res.json())
  }, [])

  const loadGruppen = useCallback(async () => {
    const [gr, lo] = await Promise.all([
      fetch(`${API_BASE}/api/gruppen`, { credentials: 'include' }),
      fetch(`${API_BASE}/api/locations`, { credentials: 'include' }),
    ])
    if (gr.ok) setGruppen(await gr.json())
    if (lo.ok) setLocations(await lo.json())
    loadPriceGroups()
  }, [loadPriceGroups])

  useEffect(() => { if (tab === 'members') loadGruppen() }, [tab, loadGruppen])
  useEffect(() => { if (tab === 'preisgruppen') loadPriceGroups() }, [tab, loadPriceGroups])

  const createGruppe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGruppe.locationId || !newGruppe.vonUhrzeit || !newGruppe.bisUhrzeit || !newGruppe.wochentag || !newGruppe.priceGroupId) return
    const res = await fetch(`${API_BASE}/api/gruppen`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newGruppe),
    })
    if (res.ok) { setNewGruppe({ locationId: '', vonUhrzeit: '', bisUhrzeit: '', wochentag: '', priceGroupId: '' }); loadGruppen() }
    else { const d = await res.json().catch(() => ({})); setGruppenMsg(d.error ?? 'Fehler beim Erstellen') }
  }

  const updateGruppePreisgruppe = async (gruppeId: string, priceGroupId: string) => {
    const res = await fetch(`${API_BASE}/api/gruppen/${gruppeId}/preisgruppe`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceGroupId }),
    })
    if (res.ok) loadGruppen()
  }

  const createPriceGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPriceGroup.name.trim()) return
    const res = await fetch(`${API_BASE}/api/pricing/groups`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPriceGroup),
    })
    if (res.ok) { setNewPriceGroup({ name: '', description: '' }); loadPriceGroups() }
    else { const d = await res.json().catch(() => ({})); setPriceGroupsMsg(d.error ?? 'Fehler beim Erstellen') }
  }

  const deletePriceGroup = async (id: string) => {
    if (!confirm('Preisgruppe wirklich löschen?')) return
    const res = await fetch(`${API_BASE}/api/pricing/groups/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) loadPriceGroups()
    else { const d = await res.json().catch(() => ({})); setPriceGroupsMsg(d.error ?? 'Löschen fehlgeschlagen') }
  }

  const fetchRates = async (groupId: string): Promise<PriceRate[]> => {
    const res = await fetch(`${API_BASE}/api/pricing/groups/${groupId}/rates`, { credentials: 'include' })
    return res.ok ? res.json() : []
  }

  const toggleRateHistory = async (groupId: string) => {
    if (rateHistory[groupId]) {
      setRateHistory(prev => { const next = { ...prev }; delete next[groupId]; return next })
      return
    }
    const rates = await fetchRates(groupId)
    setRateHistory(prev => ({ ...prev, [groupId]: rates }))
  }

  const addRate = async (groupId: string) => {
    const draft = newRate[groupId]
    if (!draft || !draft.amountEuro || !draft.validFrom) return
    const amountCents = Math.round(parseFloat(draft.amountEuro.replace(',', '.')) * 100)
    if (!Number.isFinite(amountCents) || amountCents <= 0) return
    const res = await fetch(`${API_BASE}/api/pricing/groups/${groupId}/rates`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents, validFrom: draft.validFrom }),
    })
    if (res.ok) {
      setNewRate(prev => ({ ...prev, [groupId]: { amountEuro: '', validFrom: '' } }))
      loadPriceGroups()
      if (rateHistory[groupId]) {
        const rates = await fetchRates(groupId)
        setRateHistory(prev => ({ ...prev, [groupId]: rates }))
      }
    }
  }

  const formatEuro = (cents: number) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

  // Beitrittsanträge
  interface Antrag {
    id: string
    antragstellerVorname: string
    antragstellerNachname: string
    email: string
    telefon: string | null
    fuerKind: boolean
    kindVorname: string | null
    kindNachname: string | null
    alterJahre: number | null
    gitarrenErfahrung: string | null
    status: 'NEU' | 'IN_KONTAKT' | 'ANGENOMMEN' | 'ABGELEHNT'
    boardNotiz: string | null
    createdAt: string
    gitarrengruppe?: { id: string; wochentag: string; vonUhrzeit: string; bisUhrzeit: string }
  }
  const [antraege, setAntraege] = useState<Antrag[]>([])
  const [antragStatusFilter, setAntragStatusFilter] = useState<'ALLE' | Antrag['status']>('ALLE')
  const [antragNotizDraft, setAntragNotizDraft] = useState<Record<string, string>>({})
  const [antragGruppeDraft, setAntragGruppeDraft] = useState<Record<string, string>>({})

  const loadAntraege = useCallback(async () => {
    const query = antragStatusFilter !== 'ALLE' ? `?status=${antragStatusFilter}` : ''
    const res = await fetch(`${API_BASE}/api/beitritt${query}`, { credentials: 'include' })
    if (res.ok) setAntraege(await res.json())
  }, [antragStatusFilter])

  useEffect(() => { if (tab === 'antraege') { loadAntraege(); loadGruppen() } }, [tab, loadAntraege, loadGruppen])

  const patchAntrag = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE}/api/beitritt/${id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) loadAntraege()
    return res
  }

  const annehmenAntrag = async (id: string) => {
    if (!confirm('Antrag annehmen und Einladung mit Unterrichtsdetails & Preis verschicken?')) return
    const res = await fetch(`${API_BASE}/api/beitritt/${id}/annehmen`, { method: 'POST', credentials: 'include' })
    if (res.ok) loadAntraege()
    else { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Annahme fehlgeschlagen') }
  }

  const deleteAntrag = async (id: string) => {
    if (!confirm('Antrag wirklich löschen? Das kann nicht rückgängig gemacht werden.')) return
    const res = await fetch(`${API_BASE}/api/beitritt/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) loadAntraege()
    else alert('Löschen fehlgeschlagen')
  }

  const antragStatusLabel = (s: Antrag['status']) =>
    ({ NEU: 'Neu', IN_KONTAKT: 'In Kontakt', ANGENOMMEN: 'Angenommen', ABGELEHNT: 'Abgelehnt' }[s])

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
    if (res.ok) { setNewLocation({ name: '', adresse: '', parkplatzInfo: '' }); loadGruppen() }
  }

  const deleteLocation = async (id: string) => {
    if (!confirm('Location wirklich löschen?')) return
    await fetch(`${API_BASE}/api/locations/${id}`, { method: 'DELETE', credentials: 'include' })
    loadGruppen()
  }

  const updateLocationParkplatz = async (id: string, parkplatzInfo: string) => {
    await fetch(`${API_BASE}/api/locations/${id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parkplatzInfo }),
    })
    loadGruppen()
  }

  const switchTab = (t: 'pages' | 'assets' | 'meldungen' | 'settings' | 'members' | 'videos' | 'preisgruppen' | 'antraege' | 'kalender') => {
    setTab(t); setSelectedPage(null)
    if (typeof window !== 'undefined') localStorage.setItem('admin_tab', t)
  }

  useEffect(() => { document.title = 'Admin – Schwalmtalzupfer' }, [])

  useEffect(() => { if (!loading && (!user || (!isBoard(user) && !isChef(user)))) router.push('/') }, [user, loading, router])

  // Redirect board/chef users (non-admin) to members tab by default
  useEffect(() => {
    if (!loading && user && !isAdmin(user) && (isBoard(user) || isChef(user)) && !boardTabInit) {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('admin_tab') : null
      if (!saved || saved === 'pages' || saved === 'assets' || saved === 'settings' || saved === 'videos') {
        setTab('members')
      }
      setBoardTabInit(true)
    }
  }, [user, loading, boardTabInit])

  const loadPages = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/pages`, { credentials: 'include' })
      if (res.ok) { setPages(await res.json()); setPageActionError(null) }
      else setPageActionError(`Seiten konnten nicht geladen werden (${res.status})`)
    } catch {
      setPageActionError('Seiten konnten nicht geladen werden (Netzwerkfehler)')
    }
  }, [])

  useEffect(() => { if (tab === 'pages') loadPages() }, [tab, loadPages])

  const createPage = async () => {
    if (!newSlug.trim() || !newTitle.trim()) return
    setPageActionError(null)
    const res = await fetch(`${API_BASE}/api/pages`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: newSlug.trim(), title: newTitle.trim() }),
    })
    if (!res.ok) { setPageActionError(`Seite anlegen fehlgeschlagen (${res.status})`); showToast('Seite anlegen fehlgeschlagen.', 'error'); return }
    const created: PageMeta = await res.json()
    setNewSlug(''); setNewTitle('')
    showToast('Seite angelegt - du kannst sie jetzt direkt bearbeiten.', 'success')
    await loadPages()
    setSelectedPage(created)
  }

  const [pageToDelete, setPageToDelete] = useState<string | null>(null)
  const deletePage = async (slug: string | undefined) => {
    if (!slug) { setPageActionError('Seite hat keinen Slug – Löschen nicht möglich.'); return }
    setPageActionError(null)
    const res = await fetch(`${API_BASE}/api/pages/${slug}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) { setPageActionError(`Löschen fehlgeschlagen (${res.status})`); showToast('Löschen fehlgeschlagen.', 'error'); return }
    showToast('Seite gelöscht.', 'success')
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
    if (res.ok) { setEditingPage(null); showToast('Seite gespeichert.', 'success'); loadPages() }
    else { setPageActionError(`Speichern fehlgeschlagen (${res.status})`); showToast('Speichern fehlgeschlagen.', 'error') }
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-gray-400">Laden…</div>
  if (!user || (!isBoard(user) && !isChef(user))) return null

  type TabKey = 'pages' | 'assets' | 'meldungen' | 'settings' | 'members' | 'videos' | 'preisgruppen' | 'antraege' | 'kalender'
  interface TabDef { key: TabKey; icon: string; label: string; desc: string }
  interface TabGroup { group: string; items: TabDef[] }
  const tabDef = (key: TabKey, icon: string, label: string, desc: string): TabDef => ({ key, icon, label, desc })

  const TAB_GROUPS: TabGroup[] = [
    {
      group: 'Inhalte',
      items: isAdmin(user) ? [
        tabDef('pages', '📄', 'Seiten', 'CMS-Seiten & Sektionen'),
        tabDef('meldungen', '📣', 'Meldungen', 'Banner & Infos zu Terminen'),
      ] : [],
    },
    {
      group: 'Medien',
      items: [
        ...(isAdmin(user) ? [tabDef('assets', '🗂', 'Assets', 'Bilder & Dateien (R2)')] : []),
        tabDef('videos', '🎬', 'Videos', 'YouTube-Videos verwalten'),
      ],
    },
    {
      group: 'Mitglieder',
      items: [
        tabDef('members', '👥', 'Mitglieder', 'Einladungen & Gruppen'),
        ...(isChef(user) ? [
          tabDef('antraege', '📝', 'Beitrittsanträge', 'Anträge prüfen & zuweisen'),
          tabDef('preisgruppen', '💶', 'Preisgruppen', 'Beiträge & Preishistorie'),
        ] : []),
      ],
    },
    {
      group: 'Verwaltung',
      items: [
        tabDef('kalender', '🗓️', 'Kalender', 'Termine, Unterricht & Ferien'),
        ...(isAdmin(user) ? [tabDef('settings', '⚙️', 'Einstellungen', 'Logo, Noten, Navigation')] : []),
      ],
    },
  ].filter(g => g.items.length > 0)

  const flatTabs = TAB_GROUPS.flatMap(g => g.items)
  const activeTabDef = flatTabs.find(t => t.key === tab)
  const roleLabel = user.role === 'ROLE_ADMIN' ? 'Administrator' : user.role === 'ROLE_CHEF' ? 'Chef' : user.role === 'ROLE_BOARD' ? 'Vorstand' : user.role

  const navButtonClass = (active: boolean) =>
    `flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition whitespace-nowrap
     ${active ? 'bg-green-600/15 text-green-400' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`

  return (
    <div className="min-h-screen md:flex">
      <AdminDocsPanel open={docsOpen} onClose={() => setDocsOpen(false)} />
      <ConfirmDialog
        open={pageToDelete !== null}
        title="Seite löschen"
        message={`Seite "${pageToDelete}" wirklich löschen? Das kann nicht rückgängig gemacht werden.`}
        confirmLabel="Löschen"
        onConfirm={() => { const slug = pageToDelete; setPageToDelete(null); deletePage(slug ?? undefined) }}
        onCancel={() => setPageToDelete(null)}
      />

      {/* ── Sidebar (Desktop) ────────────────────────────────────────────── */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:sticky md:top-0 md:h-screen shrink-0 border-r border-white/8 bg-slate-900/60">
        <div className="flex items-center gap-3 h-16 px-5 border-b border-white/8">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white shrink-0">
            {(user.username || user.email || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-none truncate">{user.username || user.email}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{roleLabel}</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {TAB_GROUPS.map(g => (
            <div key={g.group}>
              <p className="px-2.5 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{g.group}</p>
              <div className="space-y-0.5">
                {g.items.map(t => (
                  <button key={t.key} onClick={() => switchTab(t.key)} className={navButtonClass(tab === t.key)}>
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/8 p-3 space-y-0.5">
          <button onClick={() => setDocsOpen(true)} className={navButtonClass(false)}>
            <span>❓</span><span>Hilfe &amp; Doku</span>
          </button>
          <a href="/" target="_blank" className={navButtonClass(false)}>
            <span>🔗</span><span>Website ansehen</span>
          </a>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* ── Mobile tab navigation ──────────────────────────────────────── */}
        <div className="md:hidden border-b border-white/8 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
          <div className="px-4 flex items-center justify-between h-14 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-[11px] font-bold text-white shrink-0">
                {(user.username || user.email || '?')[0].toUpperCase()}
              </div>
              <p className="text-sm font-semibold text-white truncate">{user.username || user.email}</p>
            </div>
            <button onClick={() => setDocsOpen(true)} className="text-xs text-gray-400 hover:text-white transition shrink-0">❓ Hilfe</button>
          </div>
          <div className="overflow-x-auto flex px-2 pb-1">
            {flatTabs.map(t => (
              <button key={t.key} onClick={() => switchTab(t.key)}
                className={`relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap
                  ${tab === t.key ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
                {tab === t.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 rounded-full" />}
              </button>
            ))}
          </div>
        </div>

        {/* ── Desktop header ─────────────────────────────────────────────── */}
        <div className="hidden md:flex items-center justify-between h-16 px-6 border-b border-white/8 bg-slate-900/40 backdrop-blur-md sticky top-0 z-30">
          <div>
            <h1 className="text-sm font-bold text-white">{activeTabDef?.icon} {activeTabDef?.label}</h1>
            {activeTabDef?.desc && <p className="text-xs text-gray-500 mt-0.5">{activeTabDef.desc}</p>}
          </div>
          <button onClick={() => setDocsOpen(true)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:border-white/20 transition">
            ❓ Hilfe
          </button>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">

      {tab === 'assets' && (
        <div className="space-y-6">
          <SectionHeader icon="🗂" title="Assets" desc="Bilder & Dateien in R2 verwalten" />
          <AssetBrowser />
        </div>
      )}

      {tab === 'meldungen' && (
        <div className="space-y-6">
          <SectionHeader icon="📣" title="Meldungen & Info-Banner" desc="Ankündigungen und Infos zu Terminen" />
          <MeldungenEditor />
        </div>
      )}

      {tab === 'settings' && <SiteSettingsEditor />}

      {tab === 'kalender' && (
        <div className="space-y-6">
          <SectionHeader icon="🗓️" title="Kalender" desc="Termine, Unterricht & Ferien verwalten" />
          <KalenderTab />
        </div>
      )}

      {tab === 'videos' && (
        <div className="space-y-6">
          <SectionHeader icon="🎬" title="Videos" desc="YouTube-Videos verwalten" />
          <VideosManager />
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-6">
          <SectionHeader icon="👥" title="Mitgliederverwaltung" desc="Einladungen versenden, Gruppen verwalten" />

          {/* Link zur Mitgliederverwaltung (nur Chef/Admin - kümmern sich um die Mitglieder) */}
          {isChef(user) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a href="/admin/members"
                className="group flex items-center gap-4 rounded-xl border border-white/10 bg-slate-900 p-5 hover:border-green-500/40 hover:bg-slate-800/60 transition">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-green-900/30 text-2xl">👥</div>
                <div>
                  <p className="font-semibold text-white group-hover:text-green-400 transition">Mitglieder verwalten</p>
                  <p className="mt-0.5 text-xs text-gray-400">Suchen, deaktivieren, Gruppen zuweisen, Verlauf</p>
                </div>
                <span className="ml-auto text-gray-500 group-hover:text-green-400 transition text-lg">→</span>
              </a>
            </div>
          )}

          {/* Einladungsformular (nur Vorstand/Admin) */}
          {isBoard(user) && (
          <div className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
            <div className="border-b border-white/10 px-6 py-4">
              <h3 className="font-semibold text-white">✉️ Mitglied einladen</h3>
              <p className="mt-0.5 text-xs text-gray-400">Sendet einen Einladungslink per E-Mail. BOARD kann nur MEMBER und BOARD einladen.</p>
            </div>
            <div className="p-6">
              {inviteMsg && <div className={`mb-4 rounded-lg px-4 py-2.5 text-sm ${inviteMsg.includes('verschickt') ? 'bg-green-900/30 border border-green-500/20 text-green-400' : 'bg-red-900/30 border border-red-500/20 text-red-400'}`}>{inviteMsg}</div>}
              <form onSubmit={sendInvite} className="flex flex-wrap gap-3">
                <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  placeholder="E-Mail-Adresse"
                  className="flex-1 min-w-[200px] rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none" />
                <select value={inviteRolle} onChange={e => setInviteRolle(e.target.value)}
                  className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none">
                  <option value="MEMBER">Mitglied</option>
                  <option value="BOARD">Vorstand</option>
                  {user.role === 'ROLE_ADMIN' && <option value="CHEF">Chef</option>}
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
                    <p className="text-xs font-semibold text-yellow-400">📋 Einladungslink (Fallback, falls Mail nicht ankam)</p>
                    <button type="button" onClick={copyInviteToken}
                      className="rounded-lg border border-yellow-500/30 bg-yellow-900/20 px-3 py-1 text-xs font-medium text-yellow-300 hover:bg-yellow-800/30 transition">
                      {inviteTokenCopied ? '✓ Kopiert!' : 'Link kopieren'}
                    </button>
                  </div>
                  <code className="block break-all rounded-lg bg-slate-950/60 p-3 text-xs text-gray-300 font-mono select-all">
                    {`${typeof window !== 'undefined' ? window.location.origin : ''}/register?token=${inviteToken}`}
                  </code>
                  <p className="mt-2 text-xs text-gray-500">Diesen Link manuell weitergeben, falls die E-Mail nicht ankam.</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Gitarrengruppen */}
          <div className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
            <div className="border-b border-white/10 px-6 py-4">
              <h3 className="font-semibold text-white">🎸 Gitarrengruppen</h3>
            </div>
            <div className="p-6">
              {gruppenMsg && <p className="mb-3 rounded-lg bg-red-900/30 border border-red-500/20 px-4 py-2 text-sm text-red-400">{gruppenMsg}</p>}

              {gruppen.length > 0 ? (
                <div className="mb-5 overflow-hidden rounded-lg border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800 text-gray-400">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium">Wochentag</th>
                        <th className="px-4 py-2.5 text-left font-medium">Zeit</th>
                        <th className="px-4 py-2.5 text-left font-medium">Location</th>
                        <th className="px-4 py-2.5 text-left font-medium">Preisgruppe</th>
                        <th className="px-4 py-2.5 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {gruppen.map(g => (
                        <tr key={g.id} className="bg-slate-900 hover:bg-slate-800/60 transition">
                          <td className="px-4 py-2.5 text-white font-medium">{g.wochentag}</td>
                          <td className="px-4 py-2.5 text-gray-300">{g.vonUhrzeit} – {g.bisUhrzeit} Uhr</td>
                          <td className="px-4 py-2.5 text-gray-300">{g.location?.name ?? <span className="text-gray-600 italic">–</span>}</td>
                          <td className="px-4 py-2.5">
                            <select value={g.priceGroup?.id ?? ''} onChange={e => updateGruppePreisgruppe(g.id, e.target.value)}
                              className="rounded-lg border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white focus:border-green-500 focus:outline-none">
                              {priceGroups.map(pg => <option key={pg.id} value={pg.id}>{pg.name}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-2.5">
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
              ) : (
                <p className="mb-5 rounded-lg border border-dashed border-white/10 px-4 py-3 text-sm text-gray-500 text-center">
                  Noch keine Gruppen angelegt.
                </p>
              )}

              <div className="rounded-lg border border-white/10 bg-slate-800/40 p-4">
                <p className="mb-3 text-xs font-semibold text-gray-300">+ Neue Gruppe anlegen</p>
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
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">Preisgruppe</label>
                    <select value={newGruppe.priceGroupId} onChange={e => setNewGruppe(p => ({ ...p, priceGroupId: e.target.value }))}
                      className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none">
                      <option value="">– wählen –</option>
                      {priceGroups.map(pg => <option key={pg.id} value={pg.id}>{pg.name}</option>)}
                    </select>
                  </div>
                  <button type="submit"
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition">
                    + Anlegen
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Locations */}
          <div className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
            <div className="border-b border-white/10 px-6 py-4">
              <h3 className="font-semibold text-white">📍 Locations</h3>
            </div>
            <div className="p-6">
              {locations.length > 0 ? (
                <div className="mb-5 overflow-hidden rounded-lg border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800 text-gray-400">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium">Name</th>
                        <th className="px-4 py-2.5 text-left font-medium">Adresse</th>
                        <th className="px-4 py-2.5 text-left font-medium">Parkplatz-Hinweis</th>
                        <th className="px-4 py-2.5 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {locations.map(l => (
                        <tr key={l.id} className="bg-slate-900 hover:bg-slate-800/60 transition">
                          <td className="px-4 py-2.5 text-white font-medium">{l.name}</td>
                          <td className="px-4 py-2.5 text-gray-300">{l.adresse || <span className="text-gray-600 italic">–</span>}</td>
                          <td className="px-4 py-2.5">
                            <input
                              value={parkplatzDraft[l.id] ?? l.parkplatzInfo ?? ''}
                              onChange={e => setParkplatzDraft(p => ({ ...p, [l.id]: e.target.value }))}
                              onBlur={e => updateLocationParkplatz(l.id, e.target.value)}
                              placeholder="z.B. Parkplatz hinter der Kirche"
                              className="w-full rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1.5 text-xs text-white focus:border-green-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-2.5">
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
              ) : (
                <p className="mb-5 rounded-lg border border-dashed border-white/10 px-4 py-3 text-sm text-gray-500 text-center">
                  Noch keine Locations angelegt.
                </p>
              )}

              <div className="rounded-lg border border-white/10 bg-slate-800/40 p-4">
                <p className="mb-3 text-xs font-semibold text-gray-300">+ Neue Location anlegen</p>
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
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">Parkplatz-Hinweis (optional)</label>
                    <input value={newLocation.parkplatzInfo} onChange={e => setNewLocation(p => ({ ...p, parkplatzInfo: e.target.value }))}
                      placeholder="z.B. Parkplatz hinter der Kirche"
                      className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
                  </div>
                  <button type="submit"
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition">
                    + Anlegen
                  </button>
                </form>
              </div>
            </div>
          </div>

        </div>
      )}

      {tab === 'preisgruppen' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
            <div className="border-b border-white/10 px-6 py-4">
              <h3 className="font-semibold text-white">💶 Preisgruppen</h3>
              <p className="mt-1 text-xs text-gray-500">Beiträge pro Gruppen-Kategorie, historisiert nach "gültig ab"</p>
            </div>
            <div className="p-6">
              {priceGroupsMsg && (
                <p className="mb-4 rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-400">{priceGroupsMsg}</p>
              )}
              {priceGroups.length > 0 ? (
                <div className="mb-5 space-y-3">
                  {priceGroups.map(pg => (
                    <div key={pg.id} className="rounded-lg border border-white/10 bg-slate-800/40 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-white">{pg.name}</p>
                          {pg.description && <p className="text-xs text-gray-500">{pg.description}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-green-400">
                            {pg.currentRate ? `${formatEuro(pg.currentRate.amountCents)} / Monat` : 'kein Preis hinterlegt'}
                          </span>
                          <button onClick={() => toggleRateHistory(pg.id)}
                            className="rounded px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-gray-300 transition">
                            {rateHistory[pg.id] ? 'Historie ausblenden' : 'Historie'}
                          </button>
                          <button onClick={() => deletePriceGroup(pg.id)}
                            className="rounded px-2 py-1 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 transition">
                            Löschen
                          </button>
                        </div>
                      </div>

                      {rateHistory[pg.id] && (
                        <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-800 text-gray-400">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">Gültig ab</th>
                                <th className="px-3 py-2 text-left font-medium">Betrag</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {rateHistory[pg.id].length === 0 ? (
                                <tr><td colSpan={2} className="px-3 py-2 text-gray-500 italic">Noch keine Preise hinterlegt.</td></tr>
                              ) : rateHistory[pg.id].map(r => (
                                <tr key={r.id} className="bg-slate-900">
                                  <td className="px-3 py-2 text-gray-300">{r.validFrom}</td>
                                  <td className="px-3 py-2 text-gray-300">{formatEuro(r.amountCents)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        <div>
                          <label className="mb-1 block text-xs text-gray-400">Neuer Preis (€/Monat)</label>
                          <input value={newRate[pg.id]?.amountEuro ?? ''} placeholder="z.B. 15,00"
                            onChange={e => setNewRate(prev => ({ ...prev, [pg.id]: { amountEuro: e.target.value, validFrom: prev[pg.id]?.validFrom ?? '' } }))}
                            className="w-28 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-gray-400">Gültig ab</label>
                          <input type="date" value={newRate[pg.id]?.validFrom ?? ''}
                            onChange={e => setNewRate(prev => ({ ...prev, [pg.id]: { amountEuro: prev[pg.id]?.amountEuro ?? '', validFrom: e.target.value } }))}
                            className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
                        </div>
                        <button onClick={() => addRate(pg.id)}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition">
                          + Preis hinzufügen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-5 rounded-lg border border-dashed border-white/10 px-4 py-3 text-sm text-gray-500 text-center">
                  Noch keine Preisgruppen angelegt.
                </p>
              )}

              <div className="rounded-lg border border-white/10 bg-slate-800/40 p-4">
                <p className="mb-3 text-xs font-semibold text-gray-300">+ Neue Preisgruppe anlegen</p>
                <form onSubmit={createPriceGroup} className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">Name *</label>
                    <input value={newPriceGroup.name} onChange={e => setNewPriceGroup(p => ({ ...p, name: e.target.value }))}
                      placeholder="z.B. Orchester" required
                      className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">Beschreibung (optional)</label>
                    <input value={newPriceGroup.description} onChange={e => setNewPriceGroup(p => ({ ...p, description: e.target.value }))}
                      placeholder="z.B. für Mitglieder im Orchester"
                      className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
                  </div>
                  <button type="submit"
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition">
                    + Anlegen
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'antraege' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-slate-900 overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h3 className="font-semibold text-white">📝 Beitrittsanträge</h3>
                <p className="mt-1 text-xs text-gray-500">Anträge prüfen, Gruppe zuweisen, annehmen oder ablehnen</p>
              </div>
              <select value={antragStatusFilter} onChange={e => setAntragStatusFilter(e.target.value as any)}
                className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none">
                <option value="ALLE">Alle</option>
                <option value="NEU">Neu</option>
                <option value="IN_KONTAKT">In Kontakt</option>
                <option value="ANGENOMMEN">Angenommen</option>
                <option value="ABGELEHNT">Abgelehnt</option>
              </select>
            </div>
            <div className="p-6">
              {antraege.length === 0 ? (
                <p className="rounded-lg border border-dashed border-white/10 px-4 py-3 text-sm text-gray-500 text-center">
                  Keine Anträge in dieser Ansicht.
                </p>
              ) : (
                <div className="space-y-4">
                  {antraege.map(a => (
                    <div key={a.id} className="rounded-lg border border-white/10 bg-slate-800/40 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-white">
                            {a.antragstellerVorname} {a.antragstellerNachname}
                            {a.fuerKind && <span className="ml-2 text-xs text-gray-400">für Kind: {a.kindVorname} {a.kindNachname}</span>}
                          </p>
                          <p className="text-xs text-gray-500">{a.email}{a.telefon ? ` · ${a.telefon}` : ''}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {a.alterJahre ? `${a.alterJahre} Jahre · ` : ''}
                            {a.gitarrenErfahrung || 'keine Angaben zur Erfahrung'}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          a.status === 'NEU' ? 'bg-blue-900/40 text-blue-300' :
                          a.status === 'IN_KONTAKT' ? 'bg-yellow-900/40 text-yellow-300' :
                          a.status === 'ANGENOMMEN' ? 'bg-green-900/40 text-green-300' :
                          'bg-red-900/40 text-red-300'
                        }`}>
                          {antragStatusLabel(a.status)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        <div>
                          <label className="mb-1 block text-xs text-gray-400">Unterrichtsgruppe zuweisen</label>
                          <select
                            value={antragGruppeDraft[a.id] ?? a.gitarrengruppe?.id ?? ''}
                            onChange={e => {
                              setAntragGruppeDraft(prev => ({ ...prev, [a.id]: e.target.value }))
                              if (e.target.value) patchAntrag(a.id, { gitarrengruppeId: e.target.value })
                            }}
                            className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none">
                            <option value="">– wählen –</option>
                            {gruppen.map(g => (
                              <option key={g.id} value={g.id}>{g.wochentag} {g.vonUhrzeit}–{g.bisUhrzeit}</option>
                            ))}
                          </select>
                        </div>
                        <div className="min-w-[220px] flex-1">
                          <label className="mb-1 block text-xs text-gray-400">Vorstands-Notiz</label>
                          <input
                            value={antragNotizDraft[a.id] ?? a.boardNotiz ?? ''}
                            onChange={e => setAntragNotizDraft(prev => ({ ...prev, [a.id]: e.target.value }))}
                            onBlur={e => patchAntrag(a.id, { boardNotiz: e.target.value })}
                            className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none" />
                        </div>
                        {a.status === 'NEU' && (
                          <button onClick={() => patchAntrag(a.id, { status: 'IN_KONTAKT' })}
                            className="rounded-lg bg-yellow-700/60 px-3 py-2 text-xs font-semibold text-yellow-200 hover:bg-yellow-700 transition">
                            Kontakt aufgenommen
                          </button>
                        )}
                        {a.status !== 'ABGELEHNT' && a.status !== 'ANGENOMMEN' && (a.gitarrengruppe || antragGruppeDraft[a.id]) && (
                          <button onClick={() => annehmenAntrag(a.id)}
                            className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-500 transition">
                            Annehmen
                          </button>
                        )}
                        {a.status !== 'ABGELEHNT' && a.status !== 'ANGENOMMEN' && (
                          <button onClick={() => { if (confirm('Antrag wirklich ablehnen?')) patchAntrag(a.id, { status: 'ABGELEHNT' }) }}
                            className="rounded-lg bg-red-900/40 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-900/70 transition">
                            Ablehnen
                          </button>
                        )}
                        <button onClick={() => deleteAntrag(a.id)}
                          className="rounded-lg border border-red-900/40 px-3 py-2 text-xs font-semibold text-red-400/80 hover:bg-red-900/40 hover:text-red-400 transition">
                          Löschen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'pages' && (
        selectedPage ? (
          <PageEditor page={selectedPage} onBack={() => { setSelectedPage(null); loadPages() }} />
        ) : (
          <div className="space-y-6">
            <SectionHeader icon="📄" title="Seiten" desc="CMS-Seiten verwalten und Inhalte bearbeiten" />
            {pageActionError && (
              <div className="rounded-xl border border-red-500/40 bg-red-900/20 px-4 py-3 text-sm text-red-400">
                ⚠ {pageActionError}
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-700 border border-white/10 px-2.5 py-0.5 text-xs text-gray-400">{pages.length} Seiten</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-white/10 mb-6">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-gray-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Slug</th>
                    <th className="px-4 py-3 text-left font-medium">Titel</th>
                    <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1">Veröffentlicht <HelpHint text='Entwurf ist für Besucher unter keiner URL erreichbar. "Veröffentlicht" macht die Seite live - unabhängig davon, ob sie im Menü erscheint.' /></span>
                    </th>
                    <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1">Im Menü <HelpHint text="Steuert nur den Link in der Navigation oben. Eine versteckte Seite ist trotzdem über ihre Adresse erreichbar." /></span>
                    </th>
                    <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Sektionen</th>
                    <th className="px-4 py-3 text-left font-medium">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pages.map(p => (
                    <tr key={p.id} className="bg-slate-900 hover:bg-slate-800/60 transition">
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
                          <td className="px-4 py-3 text-gray-400 hidden sm:table-cell" />
                          <td className="px-4 py-3 text-gray-400 hidden sm:table-cell" />
                          <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{p.sections?.length ?? 0}</td>
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
                          <td className="px-4 py-3 text-white font-medium">{p.title}</td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <button
                              onClick={async () => {
                                await fetch(`${API_BASE}/api/pages/${p.slug}`, {
                                  method: 'PATCH', credentials: 'include',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ published: p.published === false ? true : false }),
                                })
                                loadPages()
                              }}
                              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                                p.published === false
                                  ? 'border-white/10 bg-slate-800 text-gray-500 hover:border-amber-500/40 hover:text-amber-400'
                                  : 'border-green-500/20 bg-green-900/20 text-green-400 hover:bg-green-900/40'
                              }`}
                            >
                              {p.published === false ? '⊘ Entwurf' : '✓ Veröffentlicht'}
                            </button>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            {p.slug ? <PageVisibilityToggle slug={p.slug} /> : <span className="text-gray-600">–</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{p.sections?.length ?? 0}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5 flex-wrap">
                              <button onClick={() => setSelectedPage(p)}
                                className="rounded px-2.5 py-1 text-xs bg-green-800/40 hover:bg-green-700/60 text-green-400 transition font-medium">📝 Bearbeiten</button>
                              <button onClick={() => setEditingPage({ id: p.id, slug: p.slug ?? '', originalSlug: p.slug ?? '', title: p.title })}
                                className="rounded px-2.5 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-gray-300 transition">✏️ Umbenennen</button>
                              {p.slug && <a href={`/${p.slug}`} target="_blank" rel="noopener noreferrer"
                                className="rounded px-2.5 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-gray-300 transition">↗</a>}
                              <button onClick={() => setPageToDelete(p.slug ?? null)}
                                className="rounded px-2.5 py-1 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 transition">✕</button>
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
              <h3 className="mb-3 font-semibold text-white text-sm">+ Neue Seite anlegen</h3>
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
    </div>
    </div>
  )
}

