import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '#lib/server/apiError.ts';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { requireAdminAuth } from '#lib/server/adminCv.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { validateDefineForSave, createApiRegistry } from '#lib/define.ts';

export const POST: RequestHandler = async ({ request, url, platform }) => {
    if (!isSameOriginRequest(request, url)) {
        return apiError(
            403,
            'FORBIDDEN_ORIGIN',
            'Cross-origin requests are not allowed on this endpoint.'
        );
    }

    const authError = await requireAdminAuth(request, platform);
    if (authError) return authError;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'INVALID_JSON_BODY', 'Request body must be valid JSON.');
    }

    const source =
        body && typeof body === 'object' ? (body as { markdown?: unknown }).markdown : undefined;
    const markdown = typeof source === 'string' ? source.trim() : '';
    if (!markdown) {
        return apiError(400, 'BLOG_DEFINE_MARKDOWN_REQUIRED', 'Markdown content is required.');
    }

    const apiRegistry = createApiRegistry(getSupabaseAdminClient(platform));
    const { ok, errors } = await validateDefineForSave(markdown, apiRegistry);

    if (!ok) {
        const messages = errors.map(e => (e.key ? `${e.key}: ${e.message}` : e.message));
        return apiError(
            422,
            'BLOG_DEFINE_VALIDATION_FAILED',
            messages.join(' | '),
            messages.join('\n')
        );
    }

    return json({ errors: [] });
};
