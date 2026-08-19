'use client'
import { getApiBase } from '@/lib/api'
import React, { useCallback, useEffect, useState } from 'react'
import { useToast } from './ui/Toast'
import { ImageField } from './ImageField'

const API_BASE = getApiBase()

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

export function normalizeAdminNavConfig(raw: Record<string, unknown>): AdminNavConfig {
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
 *  "im Menü sichtbar" sind bewusst getrennte Schalter - siehe Hilfe-Panel.
 *
 *  Wird auch außerhalb dieses Tabs verwendet (Seiten-Tab in page.tsx), daher named export. */
export function PageVisibilityToggle({ slug }: { slug: string }) {
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
export default function SettingsTab() {
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
