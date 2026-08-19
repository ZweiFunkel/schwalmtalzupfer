'use client'
import { getApiBase } from '@/lib/api'
import React, { useCallback, useEffect, useRef, useState } from 'react'

const API_BASE = getApiBase()

interface AssetFile { key: string; size: number; lastModified: string; url: string }
interface AssetListResponse { folders: string[]; files: AssetFile[]; prefix: string }

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}
function isImage(key: string) { return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(key) }

// ─── R2 Asset Browser ─────────────────────────────────────────────────────────
export default function AssetsTab() {
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
