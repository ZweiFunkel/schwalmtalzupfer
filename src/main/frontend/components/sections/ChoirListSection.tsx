import React from 'react'
import { ChoirListContent, ChoirVoice } from '@/types/page'

const VOICE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  Bass:   { bg: 'bg-blue-50 dark:bg-blue-900/30',   border: 'border-blue-300 dark:border-blue-500/30',   text: 'text-blue-700 dark:text-blue-300',   dot: 'bg-blue-400' },
  Alt:    { bg: 'bg-amber-50 dark:bg-amber-900/20',  border: 'border-amber-300 dark:border-amber-500/30',  text: 'text-amber-700 dark:text-amber-300',  dot: 'bg-amber-400' },
  Sopran: { bg: 'bg-rose-50 dark:bg-rose-900/20',   border: 'border-rose-300 dark:border-rose-500/30',   text: 'text-rose-700 dark:text-rose-300',   dot: 'bg-rose-400' },
}

function voiceColor(name: string) {
  return VOICE_COLORS[name] ?? { bg: 'bg-gray-100 dark:bg-slate-800/40', border: 'border-gray-200 dark:border-white/10', text: 'text-gray-600 dark:text-gray-300', dot: 'bg-gray-400' }
}

export default function ChoirListSection({ content }: { content: ChoirListContent }) {
  return (
    <section className="bg-white dark:bg-slate-950 py-24">
      <div className="mx-auto max-w-5xl px-6">
        {/* Header */}
        <div className="mb-14 text-center">
          <div className="mb-3 flex items-center justify-center gap-3">
            <span className="h-px w-16 bg-green-500/50 rounded-full" />
            <span className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400">Chor</span>
            <span className="h-px w-16 bg-green-500/50 rounded-full" />
          </div>
          {content.heading && <h2 className="text-4xl font-bold text-gray-900 dark:text-white">{content.heading}</h2>}
          {content.conductor && (
            <div className="mt-5 inline-flex items-center gap-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-slate-800/60 px-5 py-2.5">
              <span className="text-gray-500 dark:text-gray-400 text-sm">Leitung</span>
              <span className="h-3 w-px bg-gray-300 dark:bg-white/20" />
              <span className="font-bold text-gray-900 dark:text-white">{content.conductor}</span>
            </div>
          )}
        </div>

        {/* Voice columns */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {content.voices.map((voice: ChoirVoice, idx: number) => {
            const c = voiceColor(voice.name)
            return (
              <div key={idx} className={`rounded-2xl border ${c.border} ${c.bg} p-6`}>
                <div className="mb-5 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                  <h3 className={`text-sm font-bold uppercase tracking-widest ${c.text}`}>{voice.name}</h3>
                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{voice.members.length}</span>
                </div>
                <ul className="space-y-2">
                  {voice.members.map((member: string, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                      <span className={`h-1 w-1 rounded-full flex-shrink-0 ${c.dot} opacity-60`} />
                      {member}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
