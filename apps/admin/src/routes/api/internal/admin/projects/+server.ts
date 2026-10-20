import { getSupabaseUserClient } from '#lib/server/supabaseUser.ts';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { apiError } from '#lib/server/apiError.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { requireAdminAuth } from '#lib/server/adminCv.ts';
import { bearerToken } from '#lib/server/adminAuth.ts';
import { logActivity } from '#lib/server/activityLog.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';
import { createSupabaseAdminAuthorStore, createSupabaseAuthorWriter } from '@idstead/data';
import { sanitizeInput } from '@idstead/domain/sanitizeInput.ts';

const MAX_PINNED = 3;
const MAX_EXCLUDED = 100;
const MAX_NAME_LENGTH = 100;

function repoNames(value: unknown, max: number) {
    if (!Array.isArray(value) || value.length > max) return null;
    const names: string[] = [];
    for (const item of value) {
        if (typeof item !== 'string' || item.length > MAX_NAME_LENGTH) return null;
        const name = sanitizeInput(item.trim());
        if (name && !names.includes(name)) names.push(name);
    }
    return names;
}

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    if (!isSameOriginRequest(request, url))
        return apiError(403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are forbidden.');
    const authError = await requireAdminAuth(request, platform);
    if (authError) return authError;

    const userDb = getSupabaseUserClient(request, platform);
    const db = getSupabaseAdminClient(platform);
    if (!db || !userDb)
        return apiError(503, 'PROJECTS_STORAGE_UNAVAILABLE', 'Database is unavailable.');

    let body: { pinned?: unknown; excluded?: unknown };
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'PROJECTS_INVALID_INPUT', 'Invalid JSON body.');
    }
    const pinned = repoNames(body?.pinned, MAX_PINNED);
    const excluded = repoNames(body?.excluded, MAX_EXCLUDED);
    if (!pinned)
        return apiError(
            400,
            'PROJECTS_INVALID_INPUT',
            `Pin at most ${MAX_PINNED} repositories by name.`
        );
    if (!excluded)
        return apiError(
            400,
            'PROJECTS_INVALID_INPUT',
            `Exclude at most ${MAX_EXCLUDED} repositories by name.`
        );

    let authorId: string;
    try {
        authorId = await createSupabaseAdminAuthorStore(db).ensureProfileId();
    } catch (error) {
        console.error('Author profile lookup failed:', error);
        return apiError(503, 'PROJECTS_STORAGE_UNAVAILABLE', 'Database is unavailable.');
    }
    const result = await createSupabaseAuthorWriter(userDb).saveRepoRules(authorId, {
        pinned,
        excluded
    });
    if (result.status === 'rejected') return apiError(400, 'PROJECTS_SAVE_FAILED', result.message);

    const token = bearerToken(request);
    const actor = token ? (await db.auth.getUser(token)).data.user?.email : null;
    await logActivity(
        {
            actor: actor ?? null,
            action: 'projects.update',
            category: 'profile',
            summary: `Saved ${pinned.length} pinned and ${excluded.length} excluded repositories.`,
            ip: (() => {
                try {
                    return getClientAddress();
                } catch {
                    return null;
                }
            })(),
            ipSalt: ipSalt(platform),
            userAgent: request.headers.get('user-agent') ?? undefined
        },
        db
    );

    return json({ success: true, pinned, excluded }, { headers: { 'Cache-Control': 'no-store' } });
};
