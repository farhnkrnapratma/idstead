import type { RequestHandler } from './$types';
import { apiError } from '#lib/server/apiError.ts';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { dataStores } from '#lib/server/data.ts';
import { verifyAdminToken } from '#lib/server/adminAuth.ts';
import { parseAdminSettings } from '#lib/adminSettings.ts';

const MAX_BODY_BYTES = 2048;

async function authorize(request: Request, url: URL, platform: unknown) {
    if (!isSameOriginRequest(request, url))
        return { error: apiError(403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are forbidden.') };
    const db = getSupabaseAdminClient(platform as App.Platform | undefined);
    const service = dataStores(platform as App.Platform | undefined).service;
    if (!db || !service)
        return {
            error: apiError(503, 'ADMIN_SETTINGS_UNAVAILABLE', 'Settings storage is unavailable.')
        };
    const auth = await verifyAdminToken(request, db);
    if (auth.status)
        return { error: apiError(auth.status, auth.code ?? 'ADMIN_AUTH_REQUIRED', auth.message) };
    return { store: service.adminSettings, actor: auth.actor };
}

export const GET: RequestHandler = async ({ request, url, platform }) => {
    const ctx = await authorize(request, url, platform);
    if (ctx.error) return ctx.error;
    let stored: unknown;
    try {
        stored = await ctx.store.read(ctx.actor);
    } catch {
        return apiError(500, 'ADMIN_SETTINGS_READ_FAILED', 'Could not read settings.');
    }
    return Response.json(parseAdminSettings(stored), { headers: { 'Cache-Control': 'no-store' } });
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
    try {
        await ctx.store.write(ctx.actor, settings);
    } catch {
        return apiError(500, 'ADMIN_SETTINGS_WRITE_FAILED', 'Could not save settings.');
    }
    return Response.json(settings, { headers: { 'Cache-Control': 'no-store' } });
};
