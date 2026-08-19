'use client'

import React from 'react'
import { SpacerContent } from '@/types/page'

const SIZE_CLASSES: Record<NonNullable<SpacerContent['size']>, string> = {
  sm: 'py-4',
  md: 'py-8',
  lg: 'py-12',
}

export default function SpacerSection({ content }: { content: SpacerContent }) {
  const size = content.size ?? 'md'
  const paddingClass = SIZE_CLASSES[size]

  return (
    <div className={`bg-transparent ${paddingClass}`} aria-hidden="true">
      {content.showLine && (
        <div className="max-w-xs mx-auto border-t border-gray-200 dark:border-white/10" />
      )}
    </div>
  )
}
