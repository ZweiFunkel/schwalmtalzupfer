export type SectionType = 'HERO' | 'EVENT_CARD' | 'PERSON_GRID' | 'TEXT_BLOCK' | 'NEXT_CONCERT' | 'BAND_GRID' | 'CHOIR_LIST' | 'IMAGE_CAPTION' | 'TERMINE_LIST' | 'ACTIVITY_GRID' | 'SPONSOR_GRID'

// ---------- HERO ----------
export interface HeroContent {
  headline: string
  subheadline?: string
  backgroundImage?: string
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
}

export interface EventCardContent {
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
  name?: string         // z.B. "Parkplatz Marktplatz"
  mapUrl: string        // Google-Maps- oder Geolocation-Link
}
export interface Termin {
  title: string
  date: string          // z.B. "28.06.2026" oder "10.07. - 12.07.2026"
  time?: string         // z.B. "16:00 Uhr"
  location?: string
  mapUrl?: string       // Google-Maps-Link für den Veranstaltungsort
  parking?: TerminParking[]  // ein oder mehrere Parkmöglichkeiten
  note?: string
  kategorie: TerminKategorie
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
  sections: PageSection[]
}
