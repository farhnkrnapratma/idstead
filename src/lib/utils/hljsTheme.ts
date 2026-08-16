export type CodeColorScheme = 'auto' | 'light' | 'dark'

export function resolveHljsTheme(
  highContrast: boolean,
  siteIsDark: boolean,
  colorScheme: CodeColorScheme
): string {
  const isDark = colorScheme === 'auto' ? siteIsDark : colorScheme === 'dark'
  if (highContrast) return isDark ? 'a11y-dark' : 'a11y-light'
  return isDark ? 'atom-one-dark' : 'atom-one-light'
}
