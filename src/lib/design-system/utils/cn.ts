/** @format */

export function cn(...inputs: unknown[]): string {
  const result: string[] = []

  function process(item: unknown) {
    if (!item) return
    if (typeof item === 'string' || typeof item === 'number') {
      result.push(String(item))
    } else if (Array.isArray(item)) {
      item.forEach(process)
    } else if (typeof item === 'object' && item !== null) {
      for (const [key, value] of Object.entries(
        item as Record<string, unknown>
      )) {
        if (value) result.push(key)
      }
    }
  }

  inputs.forEach(process)
  return result.join(' ')
}
