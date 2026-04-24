'use client'

import React, { useState } from 'react'
import { PersonGridContent, Person } from '@/types/page'
import Lightbox from '@/components/Lightbox'

function PersonAvatar({ person, onClick }: { person: Person; onClick?: () => void }) {
  const zoom = person.imageZoom ?? 1
  const x = person.imageX ?? 0
  const y = person.imageY ?? 0

  if (!person.imageUrl) {
    return (
      <div className="mb-6 flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br from-green-600 to-blue-600 ring-4 ring-green-500/40 text-4xl font-bold text-white">
        {person.name.charAt(0)}
      </div>
    )
  }

  return (
    <div
      className="mb-6 h-40 w-40 overflow-hidden rounded-full ring-4 ring-green-500/60 relative flex-shrink-0 cursor-zoom-in transition hover:ring-green-400 hover:scale-105"
      onClick={onClick}
      title="Klicken zum Vergrößern"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={person.imageUrl}
        alt={person.name}
        style={{
          position: 'absolute', width: '100%', height: '100%', objectFit: 'cover',
          transform: `scale(${zoom}) translate(${x}px, ${y}px)`,
          transformOrigin: 'center',
        }}
      />
    </div>
  )
}

export default function PersonGridSection({ content }: { content: PersonGridContent }) {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)

  return (
    <section className="bg-gray-50 dark:bg-slate-900 py-24">
      <div className="mx-auto max-w-5xl px-6">
        {content.heading && (
          <h2 className="mb-4 text-center text-4xl font-bold text-gray-900 dark:text-white">{content.heading}</h2>
        )}
        {/* Musical staff decoration */}
        <div className="mx-auto mb-14 flex max-w-xs items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-px flex-1 bg-green-500/40" />
          ))}
          <span className="mx-2 text-green-400 text-xl">𝄞</span>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`r${i}`} className="h-px flex-1 bg-green-500/40" />
          ))}
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {content.persons.map((person, idx) => {
            const roles = person.roles && person.roles.length > 0
              ? person.roles
              : person.role ? [person.role] : []
            return (
              <div key={idx} className="flex flex-col items-center rounded-2xl bg-white dark:bg-slate-800/60 p-8 text-center ring-1 ring-gray-200 dark:ring-white/5 transition hover:ring-green-500/40">
                <PersonAvatar
                  person={person}
                  onClick={person.imageUrl ? () => setLightbox({ src: person.imageUrl!, alt: person.name }) : undefined}
                />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{person.name}</h3>
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {roles.map((r, i) => (
                    <span key={i} className="rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-0.5 text-xs font-semibold text-green-700 dark:text-green-400 border border-green-300 dark:border-green-500/30">
                      {r}
                    </span>
                  ))}
                </div>
                {person.bio && <p className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{person.bio}</p>}
                {person.email && (
                  <a href={`mailto:${person.email}`} className="mt-3 text-sm text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition">
                    {person.email}
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </section>
  )
}
