import { T } from '@/lib/i18n/LanguageProvider'
import type { Metadata } from 'next'
import GuitarLessons from '@/components/GuitarLessons'

export const metadata: Metadata = {
  title: 'Gitarrenunterricht',
  description: 'Gitarrenunterricht und gemeinsames Musizieren für Anfänger und Fortgeschrittene, Kinder, Jugendliche und Erwachsene. Gruppen ab dem 2. Schuljahr.',
}

export default function GuitarLessonsPage() {
  return <div className="px-4 py-8"><h1 className="mx-auto max-w-5xl text-3xl font-bold"><T value={"Gitarrenunterricht"} /></h1><GuitarLessons /></div>
}
