import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '#lib/server/apiError.ts';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { verifyAdminToken } from '#lib/server/adminAuth.ts';
import { parseAdminSettings } from '#lib/adminSettings.ts';

const MAX_BODY_BYTES = 2048;

async function authorize(request: Request, url: URL, platform: unknown) {
    if (!isSameOriginRequest(request, url))
        return { error: apiError(403, 'FORBIDDEN', 'Cross-origin requests are forbidden.') };
    const db = getSupabaseAdminClient(platform as App.Platform | undefined);
    if (!db)
        return {
            error: apiError(503, 'ADMIN_SETTINGS_UNAVAILABLE', 'Settings storage is unavailable.')
        };
    const auth = await verifyAdminToken(request, db);
    if (auth.status) return { error: apiError(auth.status, 'ADMIN_AUTH_REQUIRED', auth.message) };
    return { db, actor: auth.actor };
}

export const GET: RequestHandler = async ({ request, url, platform }) => {
    const ctx = await authorize(request, url, platform);
    if (ctx.error) return ctx.error;
    const { data, error } = await ctx.db
        .from('db_admin_settings')
        .select('settings')
        .eq('user_id', ctx.actor)
        .maybeSingle();
    if (error) return apiError(500, 'ADMIN_SETTINGS_READ_FAILED', 'Could not read settings.');
    return json(parseAdminSettings(data?.settings), { headers: { 'Cache-Control': 'no-store' } });
};

export const PUT: RequestHandler = async ({ request, url, platform }) => {
    const ctx = await authorize(request, url, platform);
    if (ctx.error) return ctx.error;
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES)
        return apiError(413, 'ADMIN_SETTINGS_TOO_LARGE', 'Settings payload is too large.');
    let body: unknown;
    try {
        body = JSON.parse(text);
    } catch {
        return apiError(400, 'ADMIN_SETTINGS_INVALID', 'Settings must be valid JSON.');
    }
    const settings = parseAdminSettings(body);
    const { error } = await ctx.db
        .from('db_admin_settings')
        .upsert({ user_id: ctx.actor, settings, updated_at: new Date().toISOString() });
    if (error) return apiError(500, 'ADMIN_SETTINGS_WRITE_FAILED', 'Could not save settings.');
    return json(settings, { headers: { 'Cache-Control': 'no-store' } });
};
