import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import ScrollButtons from '@/components/ScrollButtons'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/ThemeProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Schwalmtalzupfer',
  description: 'Offizielle Website des Schwalmtalzupfer e.V. – Jugendförderung & Musikschule',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        {/* Prevent flash: set dark class before React hydration */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}` }} />
      </head>
      <body className={`${inter.className} bg-white dark:bg-slate-950 text-gray-900 dark:text-white antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            <Navbar />
            <main>{children}</main>
            <footer className="border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-slate-950 py-12 text-sm text-gray-500">
              <div className="mx-auto max-w-5xl px-6">
                {/* Links */}
                <div className="mb-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
                  <a href="/" className="hover:text-green-600 dark:hover:text-green-400 transition">Startseite</a>
                  <a href="/konzerte" className="hover:text-green-600 dark:hover:text-green-400 transition">Konzerte</a>
                  <a href="/kontakt" className="hover:text-green-600 dark:hover:text-green-400 transition">Kontakt</a>
                  <a href="/intern" className="hover:text-green-600 dark:hover:text-green-400 transition">Mitgliederbereich</a>
                  <a href="/impressum" className="hover:text-green-600 dark:hover:text-green-400 transition">Impressum</a>
                </div>
                {/* Divider */}
                <div className="mb-4 text-center text-xl opacity-20 tracking-widest select-none">♩ ♪ ♫ ♬</div>
                {/* Copyright */}
                <p className="text-center">
                  © {new Date().getFullYear()} Die Schwalmtalzupfer e.&nbsp;V.
                </p>
              </div>
            </footer>
            <ScrollButtons />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
