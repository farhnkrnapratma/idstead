import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { dataStores } from '#lib/server/data.ts';
import { oidcEnabled } from '#lib/server/oidc/enabled.ts';
import { oidcEndpoints } from '#lib/server/oidc/config.ts';
import { resolveAuthorization } from '#lib/server/oidc/authorize.ts';

export const load: PageServerLoad = async ({ url, platform, locals, setHeaders }) => {
    setHeaders({ 'cache-control': 'no-store' });
    const session = await locals.getAdminSession();
    const signedIn = session?.role === 'admin' && session.mfaSatisfied;

    const { service } = dataStores(platform);
    if (!service || !oidcEnabled(platform))
        return {
            outcome: {
                kind: 'fatal' as const,
                message: 'Sign in with Idstead is not set up on this site.'
            },
            query: ''
        };
    let outcome: Awaited<ReturnType<typeof resolveAuthorization>>;
    try {
        outcome = await resolveAuthorization(
            { clients: service.oidcClients, auth: service.oidcAuth },
            url.searchParams,
            { issuer: oidcEndpoints(platform).issuer, authTime: signedIn ? session.authTime : null }
        );
    } catch (error) {
        console.error('OIDC authorize failed:', error);
        return {
            outcome: {
                kind: 'fatal' as const,
                message: 'The sign-in request could not be processed. Try again.'
            },
            query: ''
        };
    }
    if (outcome.kind === 'login')
        redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
    if (outcome.kind === 'redirect' && !signedIn) redirect(303, outcome.url);
    return { outcome, query: url.search };
};
