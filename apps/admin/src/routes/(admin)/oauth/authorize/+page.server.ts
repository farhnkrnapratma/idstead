import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { dataStores } from '#lib/server/data.ts';
import { oidcSigningKey } from '#lib/server/oidc/keys.ts';
import { oidcEndpoints } from '#lib/server/oidc/config.ts';
import { resolveAuthorization } from '#lib/server/oidc/authorize.ts';

export const load: PageServerLoad = async ({ url, platform, locals, setHeaders }) => {
    setHeaders({ 'cache-control': 'no-store' });
    const session = await locals.getAdminSession();
    if (!session || session.role !== 'admin' || !session.mfaSatisfied)
        redirect(303, `/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);

    const { service } = dataStores(platform);
    if (!service || !(await oidcSigningKey(platform)))
        return {
            outcome: {
                kind: 'fatal' as const,
                message: 'Sign in with Idstead is not set up on this site.'
            },
            query: ''
        };
    try {
        const outcome = await resolveAuthorization(
            { clients: service.oidcClients, auth: service.oidcAuth },
            url.searchParams,
            { issuer: oidcEndpoints(platform).issuer, authTime: session.authTime }
        );
        return { outcome, query: url.search };
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
};
