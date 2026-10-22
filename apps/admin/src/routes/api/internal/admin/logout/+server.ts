import type { RequestHandler } from './$types';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { apiError } from '#lib/server/apiError.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { dataStores } from '#lib/server/data.ts';
import { logActivity } from '#lib/server/activityLog.ts';
import { bearerToken } from '#lib/server/adminAuth.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';

export const POST: RequestHandler = async ({ request, platform, url, getClientAddress }) => {
    if (!isSameOriginRequest(request, url))
        return apiError(403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are forbidden.');

    const db = getSupabaseAdminClient(platform);
    const token = bearerToken(request);
    let actor: string | null = null;
    if (db && token) {
        const { data } = await db.auth.getUser(token);
        actor = data.user?.email ?? data.user?.id ?? null;
    }

    let ip: string | null;
    try {
        ip = getClientAddress();
    } catch {
        ip = null;
    }

    await logActivity(
        {
            actor,
            action: 'auth.logout',
            category: 'auth',
            summary: 'Admin signed out.',
            ip,
            ipSalt: ipSalt(platform),
            userAgent: request.headers.get('user-agent') ?? undefined
        },
        dataStores(platform).service?.activityLog
    );

    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
};
