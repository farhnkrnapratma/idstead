/** @format */

import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import type {RequestHandler} from './$types'

async function computeDigest(filePath: string): Promise<string> {
  try {
    const fullPath = resolve(process.cwd(), filePath)
    const content = await readFile(fullPath, 'utf-8')
    const buffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(content)
    )
    const hex = Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    return `sha256:${hex}`
  } catch (err) {
    console.error(`Failed to compute digest for ${filePath}:`, err)
    return 'sha256:0000000000000000000000000000000000000000000000000000000000000000'
  }
}

export const GET: RequestHandler = async () => {
  const [searchDigest, commentsDigest, viewsDigest] = await Promise.all([
    computeDigest('src/routes/api/search/+server.ts'),
    computeDigest('src/routes/api/comments/+server.ts'),
    computeDigest('src/routes/api/views/+server.ts')
  ])

  const index = {
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: [
      {
        name: 'search',
        type: 'skill-md',
        description:
          'Full-text search over blog posts and projects. POST /api/search with {"query": "string"}.',
        url: 'https://fkp.my.id/api/search',
        digest: searchDigest
      },
      {
        name: 'comments',
        type: 'skill-md',
        description:
          'Read (GET) or post (POST) comments on blog entries. Requires a display name and message.',
        url: 'https://fkp.my.id/api/comments',
        digest: commentsDigest
      },
      {
        name: 'views',
        type: 'skill-md',
        description:
          'Record a page view (POST /api/views with {"post_id": "string"}) or retrieve view counts.',
        url: 'https://fkp.my.id/api/views',
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
