/** @format */

import {marked} from 'marked'

export function parseMarkdownAlerts(html: string): string {
  if (!html) return ''

  return html.replace(
    /<blockquote[^>]*>\s*(?:<p>)?\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s*<\/p>|\s*<br\s*\/?>)?([\s\S]*?)<\/blockquote>/gi,
    (match, typeUpper, innerContent) => {
      const type = typeUpper.toLowerCase() as
        'note' | 'tip' | 'important' | 'warning' | 'caution'

      const config: Record<string, {title: string; icon: string}> = {
        note: {title: 'Note', icon: 'bi-info-circle-fill'},
        tip: {title: 'Tip', icon: 'bi-lightbulb-fill'},
        important: {title: 'Important', icon: 'bi-exclamation-circle-fill'},
        warning: {title: 'Warning', icon: 'bi-exclamation-triangle-fill'},
        caution: {title: 'Caution', icon: 'bi-octagon-fill'}
      }

      const alertConfig = config[type]
      let content = innerContent.trim()
      content = content.replace(/^(?:<br\s*\/?>|&gt;|>|\s)+/gi, '').trim()

      if (content && !content.startsWith('<')) {
        content = `<p>${content}</p>`
      }

      return `<div class="markdown-alert markdown-alert-${type}">
  <div class="markdown-alert-title">
    <i class="bi ${alertConfig.icon} text-base leading-none" aria-hidden="true"></i>
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
