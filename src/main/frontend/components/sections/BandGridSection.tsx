'use client'

import React, { useState } from 'react'
import { BandGridContent, Person } from '@/types/page'
import Lightbox from '@/components/Lightbox'

function BandAvatar({ person, onClick }: { person: Person; onClick?: () => void }) {
  const zoom = person.imageZoom ?? 1
  const x = person.imageX ?? 0
  const y = person.imageY ?? 0

  if (!person.imageUrl) {
    return (
      <div className="mb-5 flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-purple-700 to-slate-700 ring-4 ring-purple-500/40 text-4xl font-bold text-white">
        {person.name.charAt(0)}
      </div>
    )
  }
  return (
    <div
      className="mb-5 h-36 w-36 overflow-hidden rounded-full ring-4 ring-purple-500/50 relative flex-shrink-0 cursor-zoom-in transition hover:ring-purple-400 hover:scale-105"
      onClick={onClick}
      title="Klicken zum Vergrößern"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={person.imageUrl} alt={person.name} style={{
        position: 'absolute', width: '100%', height: '100%', objectFit: 'cover',
        transform: `scale(${zoom}) translate(${x}px, ${y}px)`, transformOrigin: 'center',
      }} />
    </div>
  )
}

export default function BandGridSection({ content }: { content: BandGridContent }) {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)

  return (
    <section className="bg-gradient-to-b from-gray-100 via-purple-50/30 to-gray-100 dark:from-slate-900 dark:via-purple-950/20 dark:to-slate-900 py-24">
      <div className="mx-auto max-w-5xl px-6">
        {content.heading && (
          <div className="mb-14 text-center">
            <div className="mb-3 flex items-center justify-center gap-3">
              <span className="h-px w-16 bg-purple-500/50 rounded-full" />
              <span className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400">Die Band</span>
              <span className="h-px w-16 bg-purple-500/50 rounded-full" />
            </div>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white">{content.heading}</h2>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-8">
          {content.persons.map((person: Person, idx: number) => {
            const roles: string[] = person.roles && person.roles.length > 0
              ? person.roles
              : person.role ? [person.role] : []
            return (
              <div key={idx} className="flex flex-col items-center w-40 text-center">
                <BandAvatar
                  person={person}
                  onClick={person.imageUrl ? () => setLightbox({ src: person.imageUrl!, alt: person.name }) : undefined}
                />
                <h3 className="font-bold text-gray-900 dark:text-white text-base leading-tight">{person.name}</h3>
                <div className="mt-2 flex flex-wrap justify-center gap-1">
                  {roles.map((r: string, i: number) => (
                    <span key={i} className="rounded-full bg-purple-100 dark:bg-purple-900/50 border border-purple-300 dark:border-purple-500/30 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </section>
  )
}
