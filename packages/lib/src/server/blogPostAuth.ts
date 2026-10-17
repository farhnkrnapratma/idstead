import type { SupabaseClient } from '@supabase/supabase-js';
import { isSameOriginRequest } from './sameOrigin';
import { verifyAdminToken, type AdminAuth } from './adminAuth';

export async function blogAdmin(
    request: Request,
    url: URL,
    db: SupabaseClient
): Promise<AdminAuth> {
    if (!isSameOriginRequest(request, url))
        return {
            status: 403,
            code: 'FORBIDDEN_ORIGIN',
            message: 'Cross-origin requests are not allowed.'
        };
    return verifyAdminToken(request, db);
}
