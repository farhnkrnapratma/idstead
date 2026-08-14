/** @format */

import type {RequestHandler} from './$types'

export const GET: RequestHandler = async () => {
  const content = `User-agent: *
Allow: /
Allow: /api/
Allow: /llms.txt
Allow: /.well-known/llms.txt
Disallow: /admin/
Disallow: /api/internal/

# Content Signals (https://contentsignals.org/)
Content-Signal: ai-train=no, search=yes, ai-input=yes

# LLM Standard (https://llmstxt.org/)
LLMS-Txt: https://fkp.my.id/llms.txt

Sitemap: https://fkp.my.id/sitemap.xml`

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400'
    }
  })
}
