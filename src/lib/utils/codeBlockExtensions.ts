const EXTENSIONS: Record<string, string> = {
  js: 'js',
  javascript: 'js',
  ts: 'ts',
  typescript: 'ts',
  html: 'html',
  css: 'css',
  rust: 'rs',
  rs: 'rs',
  python: 'py',
  py: 'py',
  bash: 'sh',
  sh: 'sh',
  shell: 'sh',
  json: 'json',
  yaml: 'yml',
  yml: 'yml',
  xml: 'xml',
  md: 'md',
  markdown: 'md',
  go: 'go',
  golang: 'go',
  cpp: 'cpp',
  c: 'c',
  csharp: 'cs',
  cs: 'cs',
  sql: 'sql'
}

export function getDownloadFilename(className: string): string {
  const match = className.match(/language-(\S+)/)
  const lang = match?.[1]?.toLowerCase() || ''

  if (lang === 'dockerfile' || lang === 'docker') return 'Dockerfile'

  const ext = EXTENSIONS[lang]
  return ext ? `snippet.${ext}` : 'snippet.txt'
}
