/** @format */

import {marked} from 'marked'

/**
 * Transforms GitHub Flavored Markdown blockquote alerts ([!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION])
 * into styled GitHub callout alert boxes.
 */
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

/**
 * Parses markdown text to HTML and applies GitHub alert transformations.
 */
export async function renderMarkdown(markdown: string): Promise<string> {
  const rawHtml = await marked.parse(markdown)
  return parseMarkdownAlerts(rawHtml)
}
