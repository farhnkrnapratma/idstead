import type { RequestHandler } from './$types';
import { blogAdmin } from '#lib/server/blogPostAuth.ts';
import { dataStores } from '#lib/server/data.ts';
import { logAdminActivity } from '#lib/server/adminRequest.ts';
import {
    ANALYTICS_PROVIDER_INFO,
    AnalyticsSettingsError,
    parseAnalyticsSettings
} from '@idstead/domain/analytics.ts';
import { apiError } from '#lib/server/apiError.ts';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_BODY_BYTES = 2048;

async function authorize(request: Request, url: URL, platform: unknown) {
    const auth = await blogAdmin(request, url, platform);
    if (auth.status)
        return {
            error: apiError(auth.status, auth.code ?? 'ADMIN_AUTH_REQUIRED', auth.message)
        } as const;
    const service = dataStores(platform).service;
    if (!service)
        return {
            error: apiError(503, 'SITE_SETTINGS_UNAVAILABLE', 'Site settings are unavailable.')
        } as const;
    return { actor: auth.actor, service } as const;
}

export const GET: RequestHandler = async ({ request, url, platform }) => {
    const ctx = await authorize(request, url, platform);
    if (ctx.error) return ctx.error;
    try {
        return Response.json(
            { analytics: await ctx.service.site.analytics() },
            { headers: NO_STORE }
        );
    } catch (error) {
        console.error('Analytics settings could not be read:', error);
        return apiError(503, 'SITE_SETTINGS_UNAVAILABLE', 'Site settings could not be read.');
    }
};

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    const ctx = await authorize(request, url, platform);
    if (ctx.error) return ctx.error;
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES)
        return apiError(413, 'SITE_SETTINGS_TOO_LARGE', 'Settings payload is too large.');
    let settings;
    try {
        settings = parseAnalyticsSettings(JSON.parse(text));
    } catch (error) {
        if (error instanceof AnalyticsSettingsError)
            return apiError(400, 'SITE_SETTINGS_INVALID', error.message, error.field);
        return apiError(400, 'SITE_SETTINGS_INVALID', 'Settings must be valid JSON.');
    }
    try {
        await ctx.service.siteSettingsWriter.saveAnalytics(settings);
    } catch (error) {
        console.error('Analytics settings could not be saved:', error);
        return apiError(503, 'SITE_SETTINGS_UNAVAILABLE', 'Site settings could not be saved.');
    }
    await logAdminActivity(
        request,
        platform,
        {
            action: 'settings.analytics',
            category: 'settings',
            entityId: settings.provider,
            summary: `Set analytics to ${ANALYTICS_PROVIDER_INFO[settings.provider].name}.`
        },
        getClientAddress
    );
    return Response.json({ analytics: settings }, { headers: NO_STORE });
};
