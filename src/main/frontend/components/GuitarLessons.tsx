import { T } from '@/lib/i18n/LanguageProvider'
import Link from 'next/link'

export default function GuitarLessons({ compact = false }: { compact?: boolean }) {
  return (
    <section aria-labelledby="guitar-lessons-title" className="mx-auto my-10 max-w-5xl rounded-2xl border border-green-500/20 bg-green-50 px-6 py-8 dark:bg-green-950/30 sm:px-10">
      <p className="mb-2 text-sm font-semibold text-green-700 dark:text-green-400"><T value={"Musik gemeinsam entdecken"} /></p>
      <h2 id="guitar-lessons-title" className="text-2xl font-bold sm:text-3xl"><T value={"Gitarrenunterricht ab dem 2. Schuljahr"} /></h2>
      <p className="mt-4 max-w-2xl text-gray-700 dark:text-gray-300"><T value={"Du möchtest Gitarre spielen lernen, hast schon Erfahrung oder möchtest einfach Teil einer großen musikalischen Gemeinschaft sein? Bei uns sind Anfänger und Fortgeschrittene, Kinder, Jugendliche und Erwachsene willkommen. Gemeinsam musizieren macht in jeder Altersgruppe Spaß - egal, ob du gerade anfängst oder deine Gitarrenkenntnisse weiterentwickeln möchtest. Unsere Gruppen beginnen ab dem 2. Schuljahr; für Fragen und Anfragen schreib uns über das Kontaktformular oder an info@schwalmtalzupfer.de."} /></p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link href={compact ? '/gitarrenunterricht' : '/kontakt?betreff=Gitarrenunterricht'} className="rounded-xl bg-green-700 px-5 py-3 text-center font-semibold text-white hover:bg-green-800"><T value={compact ? 'Zum Gitarrenunterricht' : 'Unterricht anfragen'} /></Link>
        <a href="mailto:info@schwalmtalzupfer.de?subject=Gitarrenunterricht" className="break-all rounded-xl border border-green-700/30 px-5 py-3 text-center text-green-800 dark:text-green-300"><T value={"info@schwalmtalzupfer.de"} /></a>
      </div>
    </section>
  )
}
