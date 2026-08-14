/** @format */

const RADIUS_RE = /^rounded(-(?:t|r|b|l|tl|tr|br|bl|s|e|ss|se|ee|es))?(?:-|$)/
const OVERFLOW_RE = /^overflow(-[xy])?-/
const TEXT_SIZE_KEYWORDS = new Set([
  'text-3xs',
  'text-2xs',
  'text-xxs',
  'text-xs',
  'text-sm',
  'text-base',
  'text-md',
  'text-lg',
  'text-xl',
  'text-2xl',
  'text-3xl',
  'text-4xl',
  'text-5xl',
  'text-6xl',
  'text-7xl',
  'text-8xl',
  'text-9xl'
])
const TEXT_SIZE_ARBITRARY_RE = /^text-\[[\d.]+(?:px|rem|em)\]$/

function familyOf(token: string): string | null {
  const radiusMatch = token.match(RADIUS_RE)
  if (radiusMatch) return `radius${radiusMatch[1] ?? ''}`
  if (TEXT_SIZE_KEYWORDS.has(token) || TEXT_SIZE_ARBITRARY_RE.test(token))
    return 'text-size'
  const overflowMatch = token.match(OVERFLOW_RE)
  if (overflowMatch) return `overflow${overflowMatch[1] ?? ''}`
  return null
}

export function cn(...inputs: unknown[]): string {
  const tokens: string[] = []

  function process(item: unknown) {
    if (!item) return
    if (typeof item === 'string' || typeof item === 'number') {
      tokens.push(...String(item).split(/\s+/).filter(Boolean))
    } else if (Array.isArray(item)) {
      item.forEach(process)
    } else if (typeof item === 'object') {
      for (const [key, value] of Object.entries(
        item as Record<string, unknown>
      )) {
        if (value) tokens.push(...key.split(/\s+/).filter(Boolean))
      }
    }
  }

  inputs.forEach(process)

  const familyIndex = new Map<string, number>()
  const output: (string | null)[] = []

  tokens.forEach((token, i) => {
    const family = familyOf(token)
    if (family) {
      const prevIndex = familyIndex.get(family)
      if (prevIndex !== undefined) output[prevIndex] = null
      familyIndex.set(family, i)
    }
    output.push(token)
  })

  return output.filter((t): t is string => t !== null).join(' ')
}
