export type SectionType = 'HERO' | 'EVENT_CARD' | 'PERSON_GRID' | 'TEXT_BLOCK' | 'NEXT_CONCERT' | 'BAND_GRID' | 'CHOIR_LIST' | 'IMAGE_CAPTION' | 'TERMINE_LIST' | 'ACTIVITY_GRID' | 'SPONSOR_GRID' | 'TERMINE_KONZERTE' | 'INTERN_CHANGELOG'

// ---------- HERO ----------
export interface HeroContent {
  headline: string
  subheadline?: string
  backgroundImage?: string
  overlayOpacity?: number   // 0 = kein Overlay, 1 = komplett schwarz, Standard ~0.55
  imageZoom?: number      // Zoom-Faktor: 1.0 = Standard, 2.0 = sehr nah; Standard 1.0
  imagePosition?: string  // CSS background-position, z.B. 'center', 'top', 'center 30%'
  parallax?: boolean      // Parallax-Scrolleffekt; Standard true
  ctaLabel?: string
  ctaHref?: string
}

// ---------- EVENT_CARD ----------
export interface EventCardItem {
  title: string
  date: string      // ISO-String
  location: string
  description?: string
  imageUrl?: string
  cancelled?: boolean
  cancellationNote?: string
  meldungId?: string
}

export interface EventCardContent {
  heading?: string
  events: EventCardItem[]
}

// ---------- PERSON_GRID ----------
export interface Person {
  name: string
  role?: string        // backward compat: single role
  roles?: string[]     // multiple roles/areas
  imageUrl?: string
  imageZoom?: number   // zoom factor, default 1
  imageX?: number      // pan offset px
  imageY?: number
  email?: string
  bio?: string
}

export interface PersonGridContent {
  heading?: string
  persons: Person[]
}

// ---------- TEXT_BLOCK ----------
export interface TextBlockContent {
  heading?: string
  markdown: string
}

// ---------- NEXT_CONCERT ----------
export interface NextConcertContent {
  events: EventCardItem[]
  autoFromTermine?: boolean
}

// ---------- TERMINE_KONZERTE ----------
export interface TermineKonzerteContent {
  heading?: string
  maxItems?: number
}

// ---------- BAND_GRID ----------
export interface BandGridContent {
  heading?: string
  persons: Person[]
}

// ---------- CHOIR_LIST ----------
export interface ChoirVoice {
  name: string
  members: string[]
}
export interface ChoirListContent {
  heading?: string
  conductor?: string
  voices: ChoirVoice[]
}

// ---------- IMAGE_CAPTION ----------
export interface ImageCaptionContent {
  imageUrl: string
  caption?: string
  altText?: string
}

// ---------- TERMINE_LIST ----------
export type TerminKategorie = 'konzert' | 'jugend' | 'ausflug' | 'sonstige'
export interface TerminParking {
  name?: string
  mapUrl: string
}
export interface TerminTickets {
  link?: string           // Ticket-Link
  priceAdults?: string    // z.B. "12 €"
  priceChildren?: string  // z.B. "5 €" oder "frei bis 12 J."
  info?: string           // z.B. "Kasse ab 18 Uhr, Einlass ab 19 Uhr"
}
export interface Termin {
  title: string
  date: string
  time?: string
  location?: string
  mapUrl?: string
  parking?: TerminParking[]
  note?: string            // kurze 1-Zeilen-Notiz
  details?: string         // mehrzeilige Zusatzinfos (Markdown-ähnlich)
  tickets?: TerminTickets
  kategorie: TerminKategorie
  cancelled?: boolean
  cancellationNote?: string  // wird als Absagegrund angezeigt
  meldungId?: string         // verknüpfte Meldung (zeigt Popup bei Klick auf "Weitere Infos")
}
export interface TermineListContent {
  heading?: string
  year?: string
  termine: Termin[]
}

// ---------- ACTIVITY_GRID ----------
export type ActivityAccent = 'green' | 'amber' | 'blue' | 'purple' | 'red'
export interface ActivityItem {
  title: string
  text: string
  icon?: string          // Emoji z.B. "🏕️"
  accent?: ActivityAccent
  targetGroup?: string   // z.B. "Kinder 8–12 Jahre"
}
export interface ActivityGridContent {
  heading?: string
  intro?: string         // kurzer Einleitungstext
  items: ActivityItem[]
}

// ---------- SPONSOR_GRID ----------
export interface SponsorLocation {
  name?: string      // z.B. "REWE Markt Amern"
  address: string
  mapUrl?: string
  phone?: string
}
export interface Sponsor {
  name: string
  person?: string
  imageUrl?: string
  address?: string
  mapUrl?: string
  website?: string
  phone?: string
  mobile?: string
  email?: string
  locations?: SponsorLocation[]  // für Sponsoren mit mehreren Standorten
}
export interface SponsorGridContent {
  heading?: string
  intro?: string
  sponsors: Sponsor[]
}

// ---------- INTERN_CHANGELOG ----------
export type InternChangelogEntryType = 'info' | 'new' | 'update' | 'fix'
export interface InternChangelogEntry {
  date: string
  title: string
  content: string
  type?: InternChangelogEntryType
}
export interface InternChangelogContent {
  heading?: string
  entries?: InternChangelogEntry[]
}

// ---------- Generic Section ----------
export type SectionContent =
  | HeroContent
  | EventCardContent
  | PersonGridContent
  | TextBlockContent
  | NextConcertContent
  | BandGridContent
  | ChoirListContent
  | ImageCaptionContent
  | TermineListContent
  | ActivityGridContent
  | SponsorGridContent
  | TermineKonzerteContent
  | InternChangelogContent

export interface PageSection {
  id: string
  type: SectionType
  position: number
  content: SectionContent
}

export interface PageData {
  id: string
  slug: string
  title: string
  published: boolean
  sections: PageSection[]
}
