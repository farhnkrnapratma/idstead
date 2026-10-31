// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequestHandler } from './$types';
import { blogAdmin } from '#lib/server/blogPostAuth.ts';
import { dataStores } from '#lib/server/data.ts';
import { logAdminActivity } from '#lib/server/adminRequest.ts';
import {
    CONTENT_LICENSE_INFO,
    ContentLicenseSettingsError,
    parseContentLicenseSettings
} from '@idstead/domain/contentLicense.ts';
import { apiError } from '#lib/server/apiError.ts';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_BODY_BYTES = 512;

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
            { contentLicense: await ctx.service.site.contentLicense() },
            { headers: NO_STORE }
        );
    } catch (error) {
        console.error('Content license setting could not be read:', error);
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
        settings = parseContentLicenseSettings(JSON.parse(text));
    } catch (error) {
        if (error instanceof ContentLicenseSettingsError)
            return apiError(400, 'SITE_SETTINGS_INVALID', error.message, error.field);
        return apiError(400, 'SITE_SETTINGS_INVALID', 'Settings must be valid JSON.');
    }
    try {
        await ctx.service.siteSettingsWriter.saveContentLicense(settings);
    } catch (error) {
        console.error('Content license setting could not be saved:', error);
        return apiError(503, 'SITE_SETTINGS_UNAVAILABLE', 'Site settings could not be saved.');
    }
    await logAdminActivity(
        request,
        platform,
        {
            action: 'settings.contentLicense',
            category: 'settings',
            entityId: settings.license,
            summary: `Set the content license to ${CONTENT_LICENSE_INFO[settings.license].label}.`
        },
        getClientAddress
    );
    return Response.json({ contentLicense: settings }, { headers: NO_STORE });
};
