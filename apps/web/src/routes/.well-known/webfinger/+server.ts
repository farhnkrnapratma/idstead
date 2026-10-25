import type { RequestHandler } from './$types';
import { publicRepositories } from '#lib/server/repositories.ts';
import { publicResponse } from '#lib/server/publicMetadata.ts';
import { configuredSiteUrl } from '#lib/server/siteUrl.ts';
import { oidcSigningKey } from '#lib/server/oidc/keys.ts';
import { webfingerDocument } from '#lib/server/oidc/webfinger.ts';
import { publishedEmail } from '#lib/server/publishedEmail.ts';

function failure(status: number, message: string) {
    return Response.json(
        { message },
        { status, headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } }
    );
}

export const GET: RequestHandler = async ({ request, url, platform }) => {
    const resource = url.searchParams.get('resource')?.trim();
    if (!resource) return failure(400, 'The resource parameter is required.');

    const { author } = publicRepositories();
    let profile: Awaited<ReturnType<typeof author.profile>>;
    let contact: Awaited<ReturnType<typeof author.contactLinks>>;
    try {
        [profile, contact] = await Promise.all([
            author.profile({ includeEmail: true }),
            author.contactLinks()
        ]);
    } catch {
        return failure(503, 'Identity lookup is temporarily unavailable.');
    }
    if (!profile) return failure(404, 'Not Found');

    const siteUrl = configuredSiteUrl(platform);
    const document = webfingerDocument(resource, url.searchParams.getAll('rel'), {
        siteUrl,
        username: profile.username ?? '',
        email: publishedEmail(profile.email, contact),
        hasAvatar: Boolean(profile.avatarVersion),
        issuer: (await oidcSigningKey(platform)) ? siteUrl : null
    });
    if (!document) return failure(404, 'Not Found');

    const response = await publicResponse(
        request,
        JSON.stringify(document),
        'application/jrd+json',
        300
    );
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
};
