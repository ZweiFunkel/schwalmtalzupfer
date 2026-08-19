'use client'
import React from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost'
export type ButtonSize = 'sm' | 'md'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-green-600 text-white hover:bg-green-500',
  secondary: 'bg-slate-700 text-gray-300 hover:bg-slate-600',
  destructive: 'bg-red-900/40 text-red-400 hover:bg-red-900/70',
  ghost: 'bg-transparent text-gray-400 hover:text-white hover:bg-white/5',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

/** Gemeinsamer Button-Baustein für den Admin-Bereich - ersetzt die bisher dutzendfach
 *  inline duplizierten Klassenstrings. */
export function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      className={`rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
