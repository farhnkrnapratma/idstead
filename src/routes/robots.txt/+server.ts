import type { RequestHandler } from './$types';
import * as env from '$app/env/public';
import { readSiteProfile, publicResponse } from '#lib/server/publicMetadata.ts';

export const GET: RequestHandler = async ({ request, url }) => {
    if (env.PUBLIC_SENTRY_ENVIRONMENT === 'preview' || url.hostname.endsWith('.pages.dev')) {
        return publicResponse(request, 'User-agent: *\nDisallow: /\n', 'text/plain; charset=utf-8');
    }
    const profile = await readSiteProfile();
    return publicResponse(
        request,
        `User-agent: *
Allow: /
Disallow: /admin$
Disallow: /admin/
Disallow: /api/internal$
Disallow: /api/internal/

Content-Signal: ai-train=no, search=yes, ai-input=yes

Sitemap: ${profile.siteUrl}/sitemap.xml
`,
        'text/plain; charset=utf-8'
    );
};
