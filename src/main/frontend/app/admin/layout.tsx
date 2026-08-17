'use client'

import { useEffect } from 'react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Der Adminbereich ist bewusst IMMER dunkel (siehe CLAUDE.md), unabhängig vom
  // Light/Dark-Toggle der öffentlichen Website. globals.css greift für den
  // öffentlichen Toggle aber mit `html:not(.dark) …`-Regeln direkt auf <html> zu –
  // diese Selektoren wissen nichts von diesem verschachtelten `<div className="dark">`
  // und überschreiben daher weiterhin bg-slate-900/text-white usw. hier im Admin,
  // sobald ein Redakteur auf der öffentlichen Seite "Hell" gewählt hat. Das war die
  // Ursache der gemeldeten Farbfehler ("bei hell hat man dunkle Designs").
  // Fix: <html> bekommt für die Dauer des Admin-Aufenthalts ebenfalls die Klasse
  // "dark", damit die globalen Light-Mode-Overrides hier nie greifen. Der vorherige
  // Zustand wird beim Verlassen wiederhergestellt, damit der Toggle auf der
  // öffentlichen Seite unangetastet bleibt.
  useEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains('dark')
    root.classList.add('dark')
    return () => {
      if (!hadDark) root.classList.remove('dark')
    }
  }, [])

  return (
    <div className="dark">
      <div className="min-h-screen bg-slate-950">
        {children}
      </div>
    </div>
  )
}
