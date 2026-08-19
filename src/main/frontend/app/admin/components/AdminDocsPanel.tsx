'use client'
import React, { useEffect } from 'react'

interface DocSection {
  icon: string
  title: string
  body: React.ReactNode
}

const SECTIONS: DocSection[] = [
  {
    icon: '📄',
    title: 'Seiten & Sektionen',
    body: (
      <>
        <p>Jede Seite der Website besteht aus mehreren <strong>Sektionen</strong> (Bausteinen), die von oben nach unten angezeigt werden - z.B. ein Hero-Banner, dann ein Textblock, dann ein Bild.</p>
        <p className="mt-2">Beim Bearbeiten einer Seite siehst du eine Live-Vorschau jeder Sektion direkt neben dem Formular - was du dort siehst, sieht auch der Besucher der Website.</p>
        <p className="mt-2">Neue Seiten sind sofort erreichbar, sobald du sie anlegst - du musst nichts weiter veröffentlichen oder auf einen Neustart warten.</p>
      </>
    ),
  },
  {
    icon: '👁️',
    title: 'Veröffentlicht vs. im Menü sichtbar',
    body: (
      <>
        <p>Das sind zwei unabhängige Schalter, die leicht verwechselt werden:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-4">
          <li><strong>Veröffentlicht</strong>: Ist eine Seite Entwurf, kann sie niemand außer dir über die Adresse aufrufen. Erst als "veröffentlicht" ist sie für alle erreichbar.</li>
          <li><strong>Im Menü sichtbar</strong>: Steuert nur, ob ein Link in der Navigation oben auf der Website erscheint. Eine versteckte Seite ist trotzdem erreichbar, wenn man die Adresse kennt (z.B. per Direktlink).</li>
        </ul>
      </>
    ),
  },
  {
    icon: '👥',
    title: 'Mitglieder & Rollen',
    body: (
      <>
        <p>Es gibt fünf Rollen, jede mit mehr Rechten als die vorherige: <strong>Gast</strong> → <strong>Mitglied</strong> → <strong>Vorstand</strong> → <strong>Chef</strong> → <strong>Administrator</strong>.</p>
        <p className="mt-2">Chef und Administrator verwalten gemeinsam Mitglieder, Beitrittsanträge sowie Unterrichtsgruppen/Preise. Die Admin-Rolle selbst kann nur ein bestehender Administrator vergeben.</p>
      </>
    ),
  },
  {
    icon: '📝',
    title: 'Beitrittsanträge',
    body: (
      <>
        <p>Neue Interessenten melden sich über das öffentliche Formular auf der Website an. Der Antrag landet hier zur Prüfung.</p>
        <p className="mt-2">Zum Annehmen muss zuerst eine Unterrichtsgruppe zugewiesen werden - erst dann kann die Einladung mit Preis- und Unterrichtsdetails verschickt werden.</p>
      </>
    ),
  },
  {
    icon: '🗓️',
    title: 'Kalender',
    body: (
      <p>Hier werden Termine, Unterrichtszeiten und Ferien gepflegt. Vergangene Termine wandern automatisch ins ein-/ausklappbare Archiv.</p>
    ),
  },
  {
    icon: '🗂',
    title: 'Assets & Meldungen',
    body: (
      <>
        <p><strong>Assets</strong> ist der Datei-/Bilderschrank der Website (R2-Speicher) - Bilder, die du in Seiten oder Formularen einbindest, kommen von hier.</p>
        <p className="mt-2"><strong>Meldungen</strong> sind die Ankündigungs-Banner, die oben auf der Website erscheinen können, z.B. für kurzfristige Hinweise zu Terminen.</p>
      </>
    ),
  },
]

interface AdminDocsPanelProps {
  open: boolean
  onClose: () => void
}

/** Aufklappbares Hilfe-/Dokumentations-Panel, erreichbar über den "Hilfe"-Button im
 *  Admin-Bereich. Statischer Inhalt im Code - es geht um das Tool selbst, nicht um
 *  Website-Inhalte, daher keine eigene DB-Anbindung nötig. */
export function AdminDocsPanel({ open, onClose }: AdminDocsPanelProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/70 transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <div
        className={`fixed right-0 top-0 z-50 h-screen w-full max-w-md transform overflow-y-auto border-l border-white/10 bg-slate-900 shadow-2xl transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-slate-900/95 px-5 py-4 backdrop-blur-md">
          <h2 className="text-sm font-bold text-white">❓ Hilfe &amp; Dokumentation</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition text-lg leading-none">✕</button>
        </div>
        <div className="space-y-6 p-5">
          {SECTIONS.map(s => (
            <div key={s.title} className="rounded-xl border border-white/10 bg-slate-800/40 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <span>{s.icon}</span><span>{s.title}</span>
              </h3>
              <div className="text-sm leading-relaxed text-gray-300">{s.body}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
