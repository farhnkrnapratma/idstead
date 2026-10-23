import type { RequestHandler } from './$types';
import * as env from '$app/env/public';
import { readSite, publicResponse } from '#lib/server/publicMetadata.ts';

export const GET: RequestHandler = async ({ request, url, platform }) => {
    if (
        env.PUBLIC_SENTRY_ENVIRONMENT === 'preview'
        || url.hostname.endsWith('.pages.dev')
        || url.hostname.endsWith('.workers.dev')
    ) {
        return publicResponse(request, 'User-agent: *\nDisallow: /\n', 'text/plain; charset=utf-8');
    }
    const { siteUrl } = await readSite(platform);
    return publicResponse(
        request,
        `User-agent: *
Allow: /
Disallow: /api/internal$
Disallow: /api/internal/

Content-Signal: ai-train=no, search=yes, ai-input=yes

Sitemap: ${siteUrl}/sitemap.xml
`,
        'text/plain; charset=utf-8'
    );
};
