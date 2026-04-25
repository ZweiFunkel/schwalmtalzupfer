import type { Metadata } from 'next'
import GalerieModernView from '@/components/GalerieModernView'

interface Props {
  params: { slug: string[] }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const last = params.slug[params.slug.length - 1] ?? 'Galerie'
  const title = last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ')
  return {
    title: `${title} – Galerie – Schwalmtalzupfer`,
  }
}

export default function GalerieSlugPage({ params }: Props) {
  // slug: ['sommerkonzerte', '2023'] → prefix: 'galerie/sommerkonzerte/2023/'
  const prefix = 'galerie/' + params.slug.join('/') + '/'
  return <GalerieModernView prefix={prefix} />
}
