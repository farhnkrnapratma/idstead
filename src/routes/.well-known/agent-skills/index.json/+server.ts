import type {RequestHandler} from './$types';
import {supabase} from '$lib/supabase';
import {fetchAuthorProfile} from '$lib/author';
import searchSource from '../../../api/v1/search/+server.ts?raw';
import commentsSource from '../../../api/v1/blog/comments/+server.ts?raw';
import viewsSource from '../../../api/v1/blog/views/+server.ts?raw';

async function digest(source: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(source)
  );
  const hex = Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}

export const GET: RequestHandler = async () => {
  const [authorProfile, searchDigest, commentsDigest, viewsDigest] =
    await Promise.all([
      fetchAuthorProfile(supabase),
      digest(searchSource),
      digest(commentsSource),
      digest(viewsSource)
    ]);

  const siteUrl = (authorProfile?.siteUrl || '').replace(/\/$/, '');

  const index = {
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: [
      {
        name: 'search',
        type: 'skill-md',
        description:
          'Full-text search over blog posts by title/excerpt. GET /api/v1/search?q=string&limit=number (limit defaults to 6, max 20).',
        url: `${siteUrl}/api/v1/search`,
        digest: searchDigest
      },
      {
        name: 'comments',
        type: 'skill-md',
        description:
          'GET /api/v1/blog/comments?postId=uuid returns approved comments for a post (postId omitted returns recent approved comments site-wide). Read-only — this API does not accept comment submissions.',
        url: `${siteUrl}/api/v1/blog/comments`,
        digest: commentsDigest
      },
      {
        name: 'views',
        type: 'skill-md',
        description:
          'Retrieve view counts (GET /api/v1/blog/views?postId=string). Read-only — this API does not record views.',
        url: `${siteUrl}/api/v1/blog/views`,
        digest: viewsDigest
      }
    ]
  };

  return new Response(JSON.stringify(index, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  });
};
