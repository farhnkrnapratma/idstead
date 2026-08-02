/** @format */

import {json} from '@sveltejs/kit'
import type {RequestHandler} from './$types'

export const GET: RequestHandler = async () => {
  const catalog = {
    linkset: [
      {
        anchor: 'https://fkp.my.id/api/search',
        'service-doc': [
          {
            href: 'https://fkp.my.id/api/search',
            type: 'text/html',
            title: 'Search API — full-text search over blog posts and projects'
          }
        ]
      },
      {
        anchor: 'https://fkp.my.id/api/comments',
        'service-doc': [
          {
            href: 'https://fkp.my.id/api/comments',
            type: 'text/html',
            title: 'Comments API — read and post comments on blog entries'
          }
        ]
      },
      {
        anchor: 'https://fkp.my.id/api/views',
        'service-doc': [
          {
            href: 'https://fkp.my.id/api/views',
            type: 'text/html',
            title: 'Views API — record and retrieve post view counts'
          }
        ]
      },
      {
        anchor: 'https://fkp.my.id/.well-known/openapi.json',
        'service-doc': [
          {
            href: 'https://fkp.my.id/.well-known/openapi.json',
            type: 'application/json',
            title: 'OpenAPI (machine-readable) — public API specification'
          }
        ]
      },
      {
        anchor: 'https://fkp.my.id',
        describedby: [
          {
            href: 'https://fkp.my.id/.well-known/agent-skills/index.json',
            type: 'application/json',
            title: 'Agent Skills Discovery Index'
          }
        ],
        alternate: [
          {
            href: 'https://fkp.my.id/sitemap.xml',
            type: 'application/xml',
            title: 'Sitemap'
          },
          {
            href: 'https://fkp.my.id/atom.xml',
            type: 'application/atom+xml',
            title: 'Atom Feed'
          }
        ]
      }
    ]
  }

  return json(catalog, {
    headers: {
      'Content-Type': 'application/linkset+json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
