'use client'
import { getApiBase } from '@/lib/api'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth, isAdmin, isBoard, isGuestOnly } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeProvider'

const API_BASE = getApiBase()

const SLUG_LABELS: Record<string, string> = {
  home: 'Startseite',
  konzerte: 'Konzerte',
  vorstand: 'Vorstand',
  geschichte: 'Geschichte & Leitfaden',
  leitfaden: 'Leitfaden',
  termine: 'Termine',
  jugendfahrten: 'Jugendfahrten',
  ausfluege: 'Ausflüge',
  sponsoren: 'Sponsoren',
}

interface PageMeta { id: string; slug: string; title: string }

type NavVisibility = 'public' | 'member' | 'admin' | 'guest'
interface NavDropdownGroup {
  label: string
  target?: string
  items: string[]
  visibility?: NavVisibility
}
interface NavFixedLink {
  label: string
  href: string
  visibility?: NavVisibility
  items?: { label: string; href: string }[]
}
interface NavConfig {
  dropdowns: NavDropdownGroup[]
  hidden?: string[]
  fixedLinks?: NavFixedLink[]
}

function normalizeNavConfig(raw: Record<string, unknown>): NavConfig {
  const fixedLinks = raw.fixedLinks as NavFixedLink[] | undefined
  const hidden = raw.hidden as string[] | undefined
  if (Array.isArray(raw.dropdowns)) {
    return { dropdowns: raw.dropdowns as NavDropdownGroup[], hidden, fixedLinks }
  }
  // Legacy-Format (ueberUns / vereinsleben) – fixedLinks werden jetzt auch weitergegeben
  const groups: NavDropdownGroup[] = []
  if (Array.isArray(raw.ueberUns) && (raw.ueberUns as string[]).length > 0) {
    groups.push({ label: 'Über uns', target: (raw.ueberUns as string[])[0], items: raw.ueberUns as string[] })
  }
  if (Array.isArray(raw.vereinsleben) && (raw.vereinsleben as string[]).length > 0) {
    groups.push({ label: 'Vereinsleben', items: raw.vereinsleben as string[] })
  }
  return { dropdowns: groups, hidden, fixedLinks }
}

const DEFAULT_CONFIG: NavConfig = {
  dropdowns: [
    { label: 'ber uns', target: 'geschichte', items: ['geschichte', 'konzerte', 'vorstand'] },
    { label: 'Vereinsleben', items: ['termine', 'ausfluege', 'jugendfahrten'] },
  ],
  fixedLinks: [
    { label: 'Galerie', href: '/galerie', visibility: 'public' },
    { label: 'Intern', href: '/intern', visibility: 'member', items: [
      { label: 'Videos',      href: '/intern/videos' },
      { label: 'Merch',       href: '/intern/merch' },
      { label: 'Notenarchiv', href: '/noten' },
    ]},
    { label: 'Kontakt', href: '/kontakt', visibility: 'public' },
  ],
}

// Shared dropdown panel classes
const dropdownPanel = 'absolute left-0 top-full mt-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 py-1 shadow-2xl z-50'
const dropdownItem = 'block px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400 transition'

function NavDropdownMenu({ label, target, items, onClose }: {
  label: string; target?: string; items: { slug: string; title: string }[]; onClose?: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div className="relative group/nav" ref={ref}>
      <div className="flex items-center">
        {/* Label: link if target, otherwise opens dropdown */}
        {target ? (
          <Link href={`/${target}`} className="transition hover:text-green-600 dark:hover:text-green-400 group-hover/nav:text-green-600 dark:group-hover/nav:text-green-400">{label}</Link>
        ) : (
          <button onClick={() => setOpen(o => !o)} className="transition hover:text-green-600 dark:hover:text-green-400 group-hover/nav:text-green-600 dark:group-hover/nav:text-green-400">{label}</button>
        )}
        {/* Arrow always toggles dropdown */}
        <button onClick={() => setOpen(o => !o)} className="ml-1 p-0.5 text-gray-400 group-hover/nav:text-green-500 transition">
          <svg className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {open && (
        <div className={`${dropdownPanel} w-52`}>
          {items.map(p => (
            <Link key={p.slug} href={`/${p.slug}`} className={dropdownItem}
              onClick={() => { setOpen(false); onClose?.() }}>
              {p.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function NavFixedDropdown({ link, onClose }: { link: NavFixedLink; onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  if (!link.items || link.items.length === 0) {
    return (
      <Link href={link.href} className="transition hover:text-green-600 dark:hover:text-green-400" onClick={onClose}>{link.label}</Link>
    )
  }

  return (
    <div className="relative group/nav" ref={ref}>
      <div className="flex items-center">
        <Link href={link.href} className="transition hover:text-green-600 dark:hover:text-green-400 group-hover/nav:text-green-600 dark:group-hover/nav:text-green-400">{link.label}</Link>
        <button onClick={() => setOpen(o => !o)} className="ml-1 p-0.5 text-gray-400 group-hover/nav:text-green-500 transition">
          <svg className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {open && (
        <div className={`${dropdownPanel} w-44`}>
          {link.items.map((item, i) => (
            <Link key={i} href={item.href} className={dropdownItem}
              onClick={() => { setOpen(false); onClose?.() }}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()
  const [pages, setPages] = useState<PageMeta[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [logoUrl, setLogoUrl] = useState('/assets/logo.svg')
  const [navConfig, setNavConfig] = useState<NavConfig>(DEFAULT_CONFIG)
  const userRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/pages`)
      .then(r => r.json())
      .then((data: unknown) => setPages(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`${API_BASE}/api/site/settings`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (data.logo_url) setLogoUrl(data.logo_url)
        if (data.nav_config) {
          try { setNavConfig(normalizeNavConfig(JSON.parse(data.nav_config))) } catch { /* keep default */ }
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleLogout = async () => { await logout(); router.push('/') }

  const resolveItems = (slugs: string[]) =>
    slugs.map(slug => {
      const found = pages.find(p => p.slug === slug)
      return found
        ? { slug: found.slug, title: found.title }
        : SLUG_LABELS[slug] ? { slug, title: SLUG_LABELS[slug] } : null
    }).filter(Boolean) as { slug: string; title: string }[]

  const isVisible = (visibility: NavVisibility | undefined): boolean => {
    const v = visibility ?? 'public'
    if (v === 'public') return true
    if (v === 'guest') return !user
    if (v === 'member') return !!user
    if (v === 'admin') return !!user && isAdmin(user)
    return true
  }

  const allDropdownSlugs = new Set(navConfig.dropdowns.flatMap(g => g.items).concat('home'))
  const hidden = new Set(navConfig.hidden ?? [])
  const fixedLinks: NavFixedLink[] = navConfig.fixedLinks ?? [{ label: 'Intern', href: '/intern', visibility: 'member' }, { label: 'Kontakt', href: '/kontakt', visibility: 'public' }]
  // Slugs die bereits als fixedLink geführt werden, nicht nochmal in extraPages zeigen
  const fixedLinkSlugs = new Set(fixedLinks.map(l => l.href.replace(/^\//, '')))
  const extraPages = pages.filter(p => !allDropdownSlugs.has(p.slug) && !hidden.has(p.slug) && !fixedLinkSlugs.has(p.slug))

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-white/5 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Logo */}
        <a href="/" className="flex items-center gap-3 shrink-0">
          <Image src={logoUrl} alt="Logo Schwalmtalzupfer" width={56} height={56}
            className={`h-14 w-auto object-contain brightness-0 ${theme === 'light' ? '' : 'invert'}`}
            onError={(e) => { (e.target as HTMLImageElement).src = '/assets/logo.svg' }}
          />
        </a>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-5 text-sm font-medium text-gray-600 dark:text-gray-300 md:flex">
          <Link href="/" className="transition hover:text-green-600 dark:hover:text-green-400">Startseite</Link>
          {navConfig.dropdowns.filter(g => isVisible(g.visibility)).map((group, i) => {
            const items = resolveItems(group.items)
            return (
              <NavDropdownMenu key={i} label={group.label} target={group.target} items={items} />
            )
          })}
          {extraPages.map(p => (
            <Link key={p.id} href={`/${p.slug}`} className="transition hover:text-green-600 dark:hover:text-green-400">
              {SLUG_LABELS[p.slug] ?? p.title}
            </Link>
          ))}
          {fixedLinks.filter(l => isVisible(l.visibility)).map((l, i) => (
            <NavFixedDropdown key={i} link={l} />
          ))}
        </nav>

        {/* User / Login */}
        <div className="hidden md:flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Design wechseln"
            title={theme === 'dark' ? 'Light Mode aktivieren' : 'Dark Mode aktivieren'}
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-slate-800 p-1.5 text-gray-500 dark:text-gray-400 hover:border-green-500/50 hover:text-green-600 dark:hover:text-green-400 transition"
          >
            {theme === 'dark' ? (
              /* Sun icon */
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="4" />
                <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              /* Moon icon */
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
          </button>
          {user ? (
            <div className="relative" ref={userRef}>
              <button onClick={() => setUserOpen(o => !o)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-slate-800 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:border-green-500/50 hover:text-gray-900 dark:hover:text-white transition">
                <span>👤</span>
                <span className="max-w-[120px] truncate">{[user.vorname, user.nachname].filter(Boolean).join(' ') || user.username || user.email}</span>
                <svg className={`h-3 w-3 transition-transform ${userOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {userOpen && (
                <div className={`${dropdownPanel} right-0 w-44`}>
                  {!isGuestOnly(user) && (
                    <Link href="/profil" className={dropdownItem} onClick={() => setUserOpen(false)}>
                      👤 Profil
                    </Link>
                  )}
                  {isBoard(user) && (
                    <Link href="/admin" className="block px-4 py-2.5 text-sm text-yellow-600 dark:text-yellow-400/80 hover:bg-yellow-500/10 hover:text-yellow-600 dark:hover:text-yellow-400 transition" onClick={() => setUserOpen(false)}>
                      {isAdmin(user) ? '⚙️ Admin' : '👥 Vorstand'}
                    </Link>
                  )}
                  <div className="my-1 border-t border-gray-100 dark:border-white/10" />
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-red-500 dark:text-red-400/80 hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition">
                    ↩ Abmelden
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-500 transition shadow-lg shadow-green-900/30">
              Login
            </Link>
          )}
        </div>

        {/* Mobile Burger */}
        <button onClick={() => setMenuOpen(o => !o)} className="flex flex-col gap-1.5 md:hidden" aria-label="Menü öffnen">
          <span className={`block h-0.5 w-6 bg-gray-600 dark:bg-gray-300 transition-transform duration-200 ${menuOpen ? 'translate-y-2 rotate-45' : ''}`} />
          <span className={`block h-0.5 w-6 bg-gray-600 dark:bg-gray-300 transition-opacity duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 w-6 bg-gray-600 dark:bg-gray-300 transition-transform duration-200 ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <nav className="border-t border-gray-200 dark:border-white/5 bg-white dark:bg-slate-950 px-6 py-5 md:hidden">
          <ul className="flex flex-col gap-4 text-sm font-medium text-gray-600 dark:text-gray-300">
            <li><Link href="/" className="hover:text-green-600 dark:hover:text-green-400 transition" onClick={() => setMenuOpen(false)}>Startseite</Link></li>
            {navConfig.dropdowns.filter(g => isVisible(g.visibility)).map((group, i) => (
              <li key={i} className="border-t border-gray-100 dark:border-white/5 pt-3">
                {group.target
                  ? <Link href={`/${group.target}`} className="mb-2 block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition" onClick={() => setMenuOpen(false)}>{group.label}</Link>
                  : <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{group.label}</p>
                }
                <ul className="flex flex-col gap-3 pl-3">
                  {resolveItems(group.items).map(p => (
                    <li key={p.slug}>
                      <Link href={`/${p.slug}`} className="hover:text-green-600 dark:hover:text-green-400 transition" onClick={() => setMenuOpen(false)}>{p.title}</Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {extraPages.map(p => (
              <li key={p.id}><Link href={`/${p.slug}`} className="hover:text-green-600 dark:hover:text-green-400 transition" onClick={() => setMenuOpen(false)}>{SLUG_LABELS[p.slug] ?? p.title}</Link></li>
            ))}
            {fixedLinks.filter(l => isVisible(l.visibility)).map((l, i) => (
              <li key={i} className="border-t border-gray-100 dark:border-white/5 pt-3">
                <Link href={l.href} className="hover:text-green-600 dark:hover:text-green-400 transition font-medium" onClick={() => setMenuOpen(false)}>{l.label}</Link>
                {l.items && l.items.length > 0 && (
                  <ul className="flex flex-col gap-2 pl-3 mt-2">
                    {l.items.map((item, j) => (
                      <li key={j}>
                        <Link href={item.href} className="text-sm hover:text-green-600 dark:hover:text-green-400 transition" onClick={() => setMenuOpen(false)}>{item.label}</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
            {user && isBoard(user) && <li><Link href="/admin" className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 transition" onClick={() => setMenuOpen(false)}>{isAdmin(user) ? 'Admin' : 'Vorstand'}</Link></li>}
            <li className="border-t border-gray-100 dark:border-white/5 pt-3">
              <button onClick={toggleTheme} className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition">
                {theme === 'dark' ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="4" />
                    <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                  </svg>
                )}
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </button>
            </li>
            <li className="border-t border-gray-100 dark:border-white/5 pt-3">
              {user ? (
                <div className="flex flex-col gap-2">
                  {!isGuestOnly(user) && (
                    <Link href="/profil" className="hover:text-green-600 dark:hover:text-green-400 transition" onClick={() => setMenuOpen(false)}>👤 {[user.vorname, user.nachname].filter(Boolean).join(' ') || user.username || user.email}</Link>
                  )}
                  {isGuestOnly(user) && <span className="text-gray-400">👤 {[user.vorname, user.nachname].filter(Boolean).join(' ') || user.username || user.email}</span>}
                  <button onClick={handleLogout} className="text-left text-red-500 dark:text-red-400 hover:text-red-400 transition">↩ Abmelden</button>
                </div>
              ) : (
                <Link href="/login" className="font-semibold text-green-600 dark:text-green-400 hover:text-green-500 transition" onClick={() => setMenuOpen(false)}>Login</Link>
              )}
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}
