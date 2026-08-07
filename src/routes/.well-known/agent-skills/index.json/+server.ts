/** @format */

import type {RequestHandler} from './$types'
// Bundled at build time via Vite's `?raw` import - `node:fs` reads of source
// files don't resolve against the original repo tree on Cloudflare's
// edge/worker runtime the way they do under local `vite dev`/Node, so the
// previous readFile-at-request-time approach silently failed in production.
import searchSource from '../../../api/v1/search/+server.ts?raw'
import commentsSource from '../../../api/v1/blog/comments/+server.ts?raw'
import viewsSource from '../../../api/v1/blog/views/+server.ts?raw'

async function digest(source: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(source)
  )
  const hex = Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `sha256:${hex}`
}

export const GET: RequestHandler = async () => {
  const [searchDigest, commentsDigest, viewsDigest] = await Promise.all([
    digest(searchSource),
    digest(commentsSource),
    digest(viewsSource)
  ])

  const index = {
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: [
      {
        name: 'search',
        type: 'skill-md',
        description:
          'Full-text search over blog posts by title/excerpt. GET /api/v1/search?q=string&limit=number (limit defaults to 6, max 20).',
        url: 'https://fkp.my.id/api/v1/search',
        digest: searchDigest
      },
      {
        name: 'comments',
        type: 'skill-md',
        description:
          'GET /api/v1/blog/comments?postId=uuid returns approved comments for a post (postId omitted returns recent approved comments site-wide). POST /api/v1/blog/comments with {"postId": "uuid", "content": "string", "turnstileToken": "string", "authorName": "string", "isAnonymous": boolean, "parentId": "uuid|null"} submits a new comment; authorName is required unless isAnonymous is true, and turnstileToken (a Cloudflare Turnstile response token) is always required. No login required — comments are gated by Turnstile and moderated automatically, and may be held for approval.',
        url: 'https://fkp.my.id/api/v1/blog/comments',
        digest: commentsDigest
      },
      {
        name: 'views',
        type: 'skill-md',
        description:
          'Record a page view (POST /api/v1/blog/views with {"postId": "string"}) or retrieve view counts (GET /api/v1/blog/views?postId=string).',
        url: 'https://fkp.my.id/api/v1/blog/views',
        digest: viewsDigest
      }
    ]
  }

  return new Response(JSON.stringify(index, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
