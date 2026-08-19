'use client'
import { getApiBase } from '@/lib/api'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth, isAdmin, isBoard, isChef } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import KalenderTab from './components/KalenderTab'
import AssetsTab from './components/AssetsTab'
import VideosTab from './components/VideosTab'
import MeldungenTab from './components/MeldungenTab'
import SettingsTab, { PageVisibilityToggle } from './components/SettingsTab'
import MembersTab from './components/MembersTab'
import PreisgruppenTab from './components/PreisgruppenTab'
import AntraegeTab from './components/AntraegeTab'
import { AdminDocsPanel } from './components/AdminDocsPanel'
import { ImageField, AssetPickerModal } from './components/ImageField'
import { ConfirmDialog } from './components/ui/ConfirmDialog'
import { useToast } from './components/ui/Toast'
import { HelpHint } from './components/ui/HelpHint'
import { PreviewErrorBoundary } from './components/ui/PreviewErrorBoundary'
import SectionResolver from '@/components/SectionResolver'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const API_BASE = getApiBase()

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
  const [pages, setPages] = useState<PageMeta[]>([])
  const [selectedPage, setSelectedPage] = useState<PageMeta | null>(null)
  const [newSlug, setNewSlug] = useState(''); const [newTitle, setNewTitle] = useState('')
  const [editingPage, setEditingPage] = useState<{ id: string; slug: string; originalSlug: string; title: string } | null>(null)
  const [pageActionError, setPageActionError] = useState<string | null>(null)

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
          <AssetsTab />
        </div>
      )}

      {tab === 'meldungen' && (
        <div className="space-y-6">
          <SectionHeader icon="📣" title="Meldungen & Info-Banner" desc="Ankündigungen und Infos zu Terminen" />
          <MeldungenTab />
        </div>
      )}

      {tab === 'settings' && <SettingsTab />}

      {tab === 'kalender' && (
        <div className="space-y-6">
          <SectionHeader icon="🗓️" title="Kalender" desc="Termine, Unterricht & Ferien verwalten" />
          <KalenderTab />
        </div>
      )}

      {tab === 'videos' && (
        <div className="space-y-6">
          <SectionHeader icon="🎬" title="Videos" desc="YouTube-Videos verwalten" />
          <VideosTab />
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-6">
          <SectionHeader icon="👥" title="Mitgliederverwaltung" desc="Einladungen versenden, Gruppen verwalten" />
          <MembersTab user={user} />
        </div>
      )}

      {tab === 'preisgruppen' && <PreisgruppenTab />}

      {tab === 'antraege' && <AntraegeTab />}

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

