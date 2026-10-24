import { apiError } from '../apiError';
import { blogAdmin } from '../blogPostAuth';
import { getSupabaseAdminClient } from '../supabaseAdmin';
import { dataStores, type ServiceStores } from '../data';

export type OidcAdmin =
    { ok: true; actor: string; service: ServiceStores } | { ok: false; response: Response };

export async function oidcAdmin(request: Request, url: URL, platform: unknown): Promise<OidcAdmin> {
    const db = getSupabaseAdminClient(platform);
    if (!db)
        return {
            ok: false,
            response: apiError(503, 'OIDC_UNAVAILABLE', 'Admin auth is unavailable.')
        };
    const auth = await blogAdmin(request, url, db);
    if (auth.status)
        return {
            ok: false,
            response: apiError(
                auth.status,
                auth.code ?? (auth.status === 401 ? 'ADMIN_AUTH_REQUIRED' : 'ADMIN_FORBIDDEN'),
                auth.message
            )
        };
    const { service } = dataStores(platform);
    if (!service)
        return {
            ok: false,
            response: apiError(503, 'OIDC_UNAVAILABLE', 'Database is unavailable.')
        };
    return { ok: true, actor: auth.actor, service };
}
