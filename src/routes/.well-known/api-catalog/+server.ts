import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {supabase} from '$lib/supabase';
import {fetchAuthorProfile} from '$lib/author';

export const GET: RequestHandler = async () => {
  const authorProfile = await fetchAuthorProfile(supabase);
  const siteUrl = (authorProfile?.siteUrl || '').replace(/\/$/, '');

  const catalog = {
    linkset: [
      {
        anchor: `${siteUrl}/api/v1/search`,
        'service-doc': [
          {
            href: `${siteUrl}/api/v1/search`,
            type: 'application/json',
            title: 'Search API — full-text search over blog posts'
          }
        ]
      },
      {
        anchor: `${siteUrl}/api/v1/blog/comments`,
        'service-doc': [
          {
            href: `${siteUrl}/api/v1/blog/comments`,
            type: 'application/json',
            title: 'Comments API — read comments on blog entries'
          }
        ]
      },
      {
        anchor: `${siteUrl}/api/v1/blog/views`,
        'service-doc': [
          {
            href: `${siteUrl}/api/v1/blog/views`,
            type: 'application/json',
            title: 'Views API — retrieve post view counts'
          }
        ]
      },
      {
        anchor: `${siteUrl}/.well-known/openapi.json`,
        'service-desc': [
          {
            href: `${siteUrl}/.well-known/openapi.json`,
            type: 'application/json',
            title: 'OpenAPI (machine-readable) — public API specification'
          }
        ]
      },
      {
        anchor: `${siteUrl}/api/v1`,
        'service-doc': [
          {
            href: `${siteUrl}/api/v1`,
            type: 'text/markdown',
            title:
              'Public API reference (human-readable) — all v1 endpoints, auth, CORS, versioning'
          }
        ]
      },
      {
        anchor: siteUrl,
        describedby: [
          {
            href: `${siteUrl}/.well-known/agent-skills/index.json`,
            type: 'application/json',
            title: 'Agent Skills Discovery Index'
          }
        ],
        alternate: [
          {
            href: `${siteUrl}/sitemap.xml`,
            type: 'application/xml',
            title: 'Sitemap'
          },
          {
            href: `${siteUrl}/atom.xml`,
            type: 'application/atom+xml',
            title: 'Atom Feed'
          }
        ]
      }
    ]
  };

  return json(catalog, {
    headers: {
      'Content-Type': 'application/linkset+json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  });
};
