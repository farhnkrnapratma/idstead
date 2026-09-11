import {supabase} from '$lib/supabase';
import {error} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {
  readSiteProfile,
  validDate,
  publicResponse
} from '$lib/server/publicMetadata';
import {escapeXml as xml} from '$lib/utils/xml';

export const GET: RequestHandler = async ({request}) => {
  const [profile, {data, error: failure}] = await Promise.all([
    readSiteProfile(),
    supabase
      .from('db_posts')
      .select('id,title,slug,excerpt,summary,created_at,updated_at')
      .eq('published', true)
      .order('created_at', {ascending: false})
      .order('id')
      .limit(20)
  ]);
  if (failure) error(503, 'Feed is temporarily unavailable.');
  const posts = (data ?? []).map(post => {
    const published = validDate(post.created_at);
    const updated = validDate(post.updated_at) ?? published;
    if (!published || !updated) error(503, 'Feed timestamps are unavailable.');
    return {...post, published, updated};
  });
  const timestamps = [
    validDate(profile.updated_at),
    validDate(profile.created_at),
    ...posts.map(p => p.updated)
  ]
    .filter((v): v is string => !!v)
    .sort();
  const updated = timestamps.at(-1);
  if (!updated) error(503, 'Feed timestamps are unavailable.');
  const base = profile.siteUrl;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>${xml(new URL(base).hostname)} — Blog</title>
<subtitle>${xml(profile.bio)}</subtitle>
<link href="${xml(base)}/atom.xml" rel="self" type="application/atom+xml"/>
<link href="${xml(base)}/" rel="alternate" type="text/html"/>
<id>${xml(base)}/</id><updated>${updated}</updated>
<author><name>${xml(profile.name)}</name>${profile.email ? `<email>${xml(profile.email)}</email>` : ''}<uri>${xml(base)}/</uri></author>
${posts
  .map(
    post => `<entry><title>${xml(post.title)}</title>
<link href="${xml(base + '/blog/' + encodeURIComponent(post.slug))}" rel="alternate" type="text/html"/>
<link href="${xml(base + '/api/v1/blog/' + encodeURIComponent(post.slug) + '?format=md')}" rel="alternate" type="text/markdown"/>
<id>urn:uuid:${xml(post.id)}</id><published>${post.published}</published><updated>${post.updated}</updated>
<summary type="text">${xml(post.excerpt || post.summary || '')}</summary></entry>`
  )
  .join('\n')}
</feed>`;
  return publicResponse(
    request,
    body,
    'application/atom+xml; charset=utf-8',
    300
  );
};
