import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readSite, validDate, publicResponse } from '#lib/server/publicMetadata.ts';
import { publicRepositories } from '#lib/server/repositories.ts';
import { escapeXml as xml } from '@idstead/domain/xml.ts';

export const GET: RequestHandler = async ({ request, platform }) => {
    const [{ siteUrl, profile }, latest] = await Promise.all([
        readSite(platform),
        publicRepositories()
            .blog.listPublished({ limit: 20 })
            .catch(() => null)
    ]);
    if (!latest) error(503, 'Feed is temporarily unavailable.');
    const posts = latest.posts.map(post => {
        const published = validDate(post.created_at);
        const updated = validDate(post.updated_at) ?? published;
        if (!published || !updated) error(503, 'Feed timestamps are unavailable.');
        return { ...post, published, updated };
    });
    const timestamps = [
        validDate(profile?.updated_at),
        validDate(profile?.created_at),
        ...posts.map(p => p.updated)
    ]
        .filter((v): v is string => !!v)
        .sort();
    const updated = timestamps.at(-1) ?? new Date().toISOString();
    const base = siteUrl;
    const host = new URL(base).hostname;
    const authorName = profile?.name || host;
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>${xml(host)} — Blog</title>
${profile?.bio ? `<subtitle>${xml(profile.bio)}</subtitle>` : ''}
<link href="${xml(base)}/atom.xml" rel="self" type="application/atom+xml"/>
<link href="${xml(base)}/" rel="alternate" type="text/html"/>
<id>${xml(base)}/</id><updated>${updated}</updated>
<author><name>${xml(authorName)}</name>${profile?.email ? `<email>${xml(profile.email)}</email>` : ''}<uri>${xml(base)}/</uri></author>
${posts
    .map(
        post => `<entry><title>${xml(post.title)}</title>
<link href="${xml(base + '/blog/' + encodeURIComponent(post.slug))}" rel="alternate" type="text/html"/>
<link href="${xml(base + '/blog/' + encodeURIComponent(post.slug) + '.md')}" rel="alternate" type="text/markdown"/>
<id>tag:${xml(host)},2026:post:${xml(post.id)}</id><published>${post.published}</published><updated>${post.updated}</updated>
<summary type="text">${xml(post.excerpt || post.summary || '')}</summary></entry>`
    )
    .join('\n')}
</feed>`;
    return publicResponse(request, body, 'application/atom+xml; charset=utf-8', 300);
};
