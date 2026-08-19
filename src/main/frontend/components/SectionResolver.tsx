import React from 'react'
import { PageSection, HeroContent, EventCardContent, PersonGridContent, TextBlockContent, NextConcertContent, BandGridContent, ChoirListContent, ImageCaptionContent, TermineListContent, ActivityGridContent, SponsorGridContent, TermineKonzerteContent, InternChangelogContent, ImageTextContent, CtaButtonContent, FaqContent, SpacerContent, QuoteContent, StatsContent, VideoEmbedContent } from '@/types/page'
import HeroSection from './sections/HeroSection'
import EventCardSection from './sections/EventCardSection'
import PersonGridSection from './sections/PersonGridSection'
import TextBlockSection from './sections/TextBlockSection'
import NextConcertSection from './sections/NextConcertSection'
import BandGridSection from './sections/BandGridSection'
import ChoirListSection from './sections/ChoirListSection'
import ImageCaptionSection from './sections/ImageCaptionSection'
import TermineListSection from './sections/TermineListSection'
import ActivityGridSection from './sections/ActivityGridSection'
import SponsorGridSection from './sections/SponsorGridSection'
import TermineKonzerteSection from './sections/TermineKonzerteSection'
import InternChangelogSection from './sections/InternChangelogSection'
import ImageTextSection from './sections/ImageTextSection'
import CtaButtonSection from './sections/CtaButtonSection'
import FaqSection from './sections/FaqSection'
import SpacerSection from './sections/SpacerSection'
import QuoteSection from './sections/QuoteSection'
import StatsSection from './sections/StatsSection'
import VideoEmbedSection from './sections/VideoEmbedSection'

interface Props {
  section: PageSection
  index?: number
  anchorId?: string
}

export default function SectionResolver({ section, index, anchorId }: Props) {
  switch (section.type) {
    case 'HERO':
      return <HeroSection content={section.content as HeroContent} />
    case 'EVENT_CARD':
      return <EventCardSection content={section.content as EventCardContent} />
    case 'PERSON_GRID':
      return <PersonGridSection content={section.content as PersonGridContent} />
    case 'TEXT_BLOCK':
      return <TextBlockSection content={section.content as TextBlockContent} index={index} anchorId={anchorId} />
    case 'NEXT_CONCERT':
      return <NextConcertSection content={section.content as NextConcertContent} />
    case 'BAND_GRID':
      return <BandGridSection content={section.content as BandGridContent} />
    case 'CHOIR_LIST':
      return <ChoirListSection content={section.content as ChoirListContent} />
    case 'IMAGE_CAPTION':
      return <ImageCaptionSection content={section.content as ImageCaptionContent} />
    case 'TERMINE_LIST':
      return <TermineListSection content={section.content as TermineListContent} />
    case 'ACTIVITY_GRID':
      return <ActivityGridSection content={section.content as ActivityGridContent} />
    case 'SPONSOR_GRID':
      return <SponsorGridSection content={section.content as SponsorGridContent} />
    case 'TERMINE_KONZERTE':
      return <TermineKonzerteSection content={section.content as TermineKonzerteContent} />
    case 'INTERN_CHANGELOG':
      return <InternChangelogSection content={section.content as InternChangelogContent} />
    case 'IMAGE_TEXT':
      return <ImageTextSection content={section.content as ImageTextContent} />
    case 'CTA_BUTTON':
      return <CtaButtonSection content={section.content as CtaButtonContent} />
    case 'FAQ':
      return <FaqSection content={section.content as FaqContent} />
    case 'SPACER':
      return <SpacerSection content={section.content as SpacerContent} />
    case 'QUOTE':
      return <QuoteSection content={section.content as QuoteContent} />
    case 'STATS':
      return <StatsSection content={section.content as StatsContent} />
    case 'VIDEO_EMBED':
      return <VideoEmbedSection content={section.content as VideoEmbedContent} />
    default:
      return (
        <div className="py-8 text-center text-gray-400">
          Unbekannter Sektionstyp: {(section as PageSection).type}
        </div>
      )
  }
}
