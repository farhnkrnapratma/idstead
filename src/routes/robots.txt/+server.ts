import type {RequestHandler} from './$types';
import {supabase} from '$lib/supabase';
import {fetchAuthorProfile} from '$lib/author';

export const GET: RequestHandler = async () => {
  const authorProfile = await fetchAuthorProfile(supabase);
  const siteUrl = (authorProfile?.siteUrl || '').replace(/\/$/, '');

  const content = `User-agent: *
Allow: /
Allow: /api/
Allow: /llms.txt
Allow: /.well-known/llms.txt
Disallow: /admin/
Disallow: /api/internal/

Content-Signal: ai-train=no, search=yes, ai-input=yes

LLMS-Txt: ${siteUrl}/llms.txt

Sitemap: ${siteUrl}/sitemap.xml`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400'
    }
  });
};
