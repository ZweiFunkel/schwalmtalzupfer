'use client'
import React, { useState } from 'react'

interface HelpHintProps {
  text: string
  className?: string
}

/** Kleines "?"-Icon mit Klick-Popover für kurze Erklärtexte direkt neben Feldern/Überschriften. */
export function HelpHint({ text, className = '' }: HelpHintProps) {
  const [open, setOpen] = useState(false)
  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onBlur={() => setOpen(false)}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-white/20 text-[10px] font-bold text-gray-400 hover:border-green-500 hover:text-green-400 transition"
        aria-label="Hilfe"
      >
        ?
      </button>
      {open && (
        <span className="absolute left-1/2 top-full z-20 mt-1.5 w-56 -translate-x-1/2 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-xs leading-relaxed text-gray-300 shadow-xl">
          {text}
        </span>
      )}
    </span>
  )
}
