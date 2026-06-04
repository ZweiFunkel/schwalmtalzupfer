import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import ScrollButtons from '@/components/ScrollButtons'
import AnnouncementBanner from '@/components/AnnouncementBanner'
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
        {/* YouTube IFrame Player API */}
        <script src="https://www.youtube.com/iframe_api" async />
      </head>
      <body className={`${inter.className} bg-white dark:bg-slate-950 text-gray-900 dark:text-white antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            <AnnouncementBanner />
            <Navbar />
            <main>{children}</main>
            <footer className="border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-slate-950 py-10 text-center text-sm text-gray-500">
              <div className="mb-4 text-2xl opacity-30">♩ ♪ ♫ ♬</div>

              {/* Social-Media-Buttons */}
              <div className="mb-6 flex items-center justify-center gap-3">
                {/* Facebook */}
                <a
                  href="https://www.facebook.com/schwalmtalzupfer"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1877F2] px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-[#166fe5] hover:shadow-[#1877F2]/40 hover:shadow-lg active:scale-95"
                >
                  <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987H7.898V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                  </svg>
                  Facebook
                </a>

                {/* Instagram */}
                <a
                  href="https://www.instagram.com/schwalmtalzupfer"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90 hover:shadow-[#ee2a7b]/40 hover:shadow-lg active:scale-95"
                >
                  <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                  </svg>
                  Instagram
                </a>

                {/* YouTube */}
                <a
                  href="https://www.youtube.com/@schwalmtalzupfer"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#FF0000] px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-[#cc0000] hover:shadow-[#FF0000]/40 hover:shadow-lg active:scale-95"
                >
                  <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                  YouTube
                </a>
              </div>

              {/* Copyright + Impressum-Link */}
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-4">
                <span>© {new Date().getFullYear()} Schwalmtalzupfer e.V. &nbsp;·&nbsp; Jugendförderung &amp; Musikschule</span>
                <Link
                  href="/impressum"
                  className="rounded-lg border border-gray-300 dark:border-white/10 px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 transition hover:border-green-500 hover:text-green-600 dark:hover:text-green-400"
                >
                  Impressum
                </Link>
              </div>
            </footer>
            <ScrollButtons />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
