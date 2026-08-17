import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Impressum',
  description: 'Impressum des Schwalmtalzupfer e.V.',
}

export default function ImpressumPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-gray-700 dark:text-gray-300">
      <h1 className="mb-8 text-4xl font-extrabold text-gray-900 dark:text-white">Impressum</h1>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          Angaben gemäß § 5 TMG
        </h2>
        <p>
          Jugendförderung Schwalmtalzupfer e.&nbsp;V.<br />
          Beek 8a<br />
          41334 Nettetal
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          Vertreten durch
        </h2>
        <p>
          Benjamin Münten<br />
          Frank Trepte
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Kontakt</h2>
        <p>
          E-Mail:{' '}
          <a
            href="mailto:info@schwalmtalzupfer.de"
            className="text-green-600 dark:text-green-400 hover:underline"
          >
            info@schwalmtalzupfer.de
          </a>
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          Registereintrag
        </h2>
        <p>
          Eintragung im Registergericht: Mönchengladbach<br />
          Registernummer: VR 3592
        </p>
      </section>

      <hr className="my-8 border-gray-200 dark:border-white/10" />

      <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
        Haftungsausschluss
      </h2>

      <section className="mb-6">
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          Haftung für Inhalte
        </h3>
        <p className="leading-relaxed">
          Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit,
          Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen. Als
          Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach
          den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als
          Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
          Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
          Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von
          Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine
          diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten
          Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden
          wir diese Inhalte umgehend entfernen.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          Haftung für Links
        </h3>
        <p className="leading-relaxed">
          Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen
          Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen.
          Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der
          Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf
          mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der
          Verlinkung nicht erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten Seiten
          ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei
          Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Urheberrecht</h3>
        <p className="leading-relaxed">
          Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen
          dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art
          der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen
          Zustimmung des jeweiligen Autors bzw. Erstellers. Downloads und Kopien dieser Seite sind
          nur für den privaten, nicht kommerziellen Gebrauch gestattet. Soweit die Inhalte auf
          dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter
          beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet. Sollten Sie
          trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen
          entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige
          Inhalte umgehend entfernen.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Datenschutz</h3>
        <p className="leading-relaxed">
          Die Nutzung unserer Webseite ist in der Regel ohne Angabe personenbezogener Daten
          möglich. Soweit auf unseren Seiten personenbezogene Daten (beispielsweise Name, Anschrift
          oder eMail-Adressen) erhoben werden, erfolgt dies, soweit möglich, stets auf freiwilliger
          Basis. Diese Daten werden ohne Ihre ausdrückliche Zustimmung nicht an Dritte
          weitergegeben.
        </p>
        <p className="mt-3 leading-relaxed">
          Wir weisen darauf hin, dass die Datenübertragung im Internet (z.B. bei der Kommunikation
          per E-Mail) Sicherheitslücken aufweisen kann. Ein lückenloser Schutz der Daten vor dem
          Zugriff durch Dritte ist nicht möglich.
        </p>
        <p className="mt-3 leading-relaxed">
          Der Nutzung von im Rahmen der Impressumspflicht veröffentlichten Kontaktdaten durch
          Dritte zur Übersendung von nicht ausdrücklich angeforderter Werbung und
          Informationsmaterialien wird hiermit ausdrücklich widersprochen. Die Betreiber der Seiten
          behalten sich ausdrücklich rechtliche Schritte im Falle der unverlangten Zusendung von
          Werbeinformationen, etwa durch Spam-Mails, vor.
        </p>
      </section>
    </main>
  )
}

