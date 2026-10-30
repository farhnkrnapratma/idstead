import { apiError } from '../apiError';
import { blogAdmin } from '../blogPostAuth';
import { dataStores, type ServiceStores } from '../data';

export type OidcAdmin =
    | { ok: true; actor: string; authTime: number; service: ServiceStores }
    | { ok: false; response: Response };

export async function oidcAdmin(request: Request, url: URL, platform: unknown): Promise<OidcAdmin> {
    const auth = await blogAdmin(request, url, platform);
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
    return { ok: true, actor: auth.actor, authTime: auth.authTime, service };
}
