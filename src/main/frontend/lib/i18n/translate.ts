import messages from './en.json'
export type Language = 'de' | 'en'
const dictionary: Record<string, string> = messages
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const patterns = Object.entries(dictionary).filter(([key]) => /\{\d+\}/.test(key)).map(([key, value]) => {
  const indices: string[] = []
  const parts = key.split(/(\{\d+\})/g).map(part => {
    if (/^\{\d+\}$/.test(part)) { indices.push(part); return '(.*?)' }
    return escape(part)
  })
  return { pattern: new RegExp('^' + parts.join('') + '$'), value, indices }
})
export function translate(value: string, language: Language, content: Record<string, string> = {}): string {
  if (language === 'de' || !value.trim()) return value
  const key = value.replace(/\s+/g, ' ').trim()
  let translated = content[value] ?? content[key] ?? dictionary[key]
  if (translated === undefined) {
    for (const entry of patterns) {
      const match = entry.pattern.exec(key)
      if (match) {
        translated = entry.value.replace(/\{\d+\}/g, token => {
          const index = entry.indices.indexOf(token)
          return index >= 0 ? translate(match[index + 1], language, content) : token
        })
        break
      }
    }
  }
  if (translated === undefined) return value
  return (value.startsWith(' ') ? ' ' : '') + translated + (value.endsWith(' ') ? ' ' : '')
}

