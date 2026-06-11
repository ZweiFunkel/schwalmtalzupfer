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
            <footer className="border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-slate-950 py-12 text-center text-sm text-gray-500">
              <div className="mb-2 text-2xl opacity-30">♩ ♪ ♫ ♬</div>
              © 2026 Die Schwalmtalzupfer e.V.
            </footer>
            <ScrollButtons />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
