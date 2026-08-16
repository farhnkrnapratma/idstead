import {marked} from 'marked'

export function parseMarkdownAlerts(html: string): string {
  if (!html) return ''

  return html.replace(
    /<blockquote[^>]*>\s*(?:<p>)?\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s*<\/p>|\s*<br\s*\/?>)?([\s\S]*?)<\/blockquote>/gi,
    (match, typeUpper, innerContent) => {
      const type = typeUpper.toLowerCase() as
        'note' | 'tip' | 'important' | 'warning' | 'caution'

      const config: Record<string, {title: string; svg: string}> = {
        note: {
          title: 'Note',
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-info shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
        },
        tip: {
          title: 'Tip',
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lightbulb shrink-0"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>'
        },
        important: {
          title: 'Important',
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-circle shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>'
        },
        warning: {
          title: 'Warning',
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-triangle shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>'
        },
        caution: {
          title: 'Caution',
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-octagon-alert shrink-0"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>'
        }
      }

      const alertConfig = config[type]
      let content = innerContent.trim()
      content = content.replace(/^(?:<br\s*\/?>|&gt;|>|\s)+/gi, '').trim()

      if (content && !content.startsWith('<')) {
        content = `<p>${content}</p>`
      }

      return `<div class="markdown-alert markdown-alert-${type}">
  <div class="markdown-alert-title">
    ${alertConfig.svg}
    <span>${alertConfig.title}</span>
  </div>
  <div class="markdown-alert-content">
    ${content}
  </div>
</div>`
    }
  )
}

export async function renderMarkdown(markdown: string): Promise<string> {
  const rawHtml = await marked.parse(markdown)
  return parseMarkdownAlerts(rawHtml)
}

export function injectHeadingIds(html: string): string {
  let index = 0
  const usedIds = new Set<string>()

  return html.replace(
    /<h([23])([^>]*)>(.*?)<\/h\1>/gi,
    (match, level, attrs, content) => {
      if (attrs.includes('id=')) {
        const idMatch = attrs.match(/id="([^"]*)"/)
        if (idMatch) {
          usedIds.add(idMatch[1])
        }
        return match
      }

      const text = content.replace(/<[^>]*>/g, '')
      const baseId =
        text ?
          text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
        : `heading-${index++}`

      let id = baseId
      let counter = 1
      while (usedIds.has(id)) {
        id = `${baseId}-${counter++}`
      }
      usedIds.add(id)

      return `<h${level}${attrs} id="${id}">${content}</h${level}>`
    }
  )
}

export interface HeadingItem {
  id: string
  text: string
  level: number
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

export function extractHeadings(html: string): HeadingItem[] {
  const headings: HeadingItem[] = []
  const headingRegex = /<h([23])\s+[^>]*id="([^"]*)"[^>]*>(.*?)<\/h\1>/gi
  let match
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1], 10)
    const id = match[2]
    const text = decodeHtmlEntities(match[3].replace(/<[^>]*>/g, '').trim())
    headings.push({id, text, level})
  }
  return headings
}

export async function prepareMarkdownPage(
  markdown: string
): Promise<{html: string; headings: HeadingItem[]}> {
  const rawHtml = await renderMarkdown(markdown)
  const html = injectHeadingIds(rawHtml)
  const headings = extractHeadings(html)
  return {html, headings}
}
