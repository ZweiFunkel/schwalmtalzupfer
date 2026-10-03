import { translate } from './translate'
export function translateBrowserText(value: string): string {
  if (typeof document === 'undefined') return value
  return translate(value, document.documentElement.lang === 'en' ? 'en' : 'de')
}
