import type { RequestHandler } from './$types';
import { isSameOriginRequest } from '#lib/server/sameOrigin.ts';
import { apiError } from '#lib/server/apiError.ts';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { dataStores } from '#lib/server/data.ts';
import { requireAdminAuth } from '#lib/server/adminCv.ts';
import { bearerToken } from '#lib/server/adminAuth.ts';
import { profilePatch, ProfileInputError } from '#lib/server/profilePatch.ts';
import { sanitizeInput } from '@idstead/domain/sanitizeInput.ts';
import { logActivity } from '#lib/server/activityLog.ts';
import { ipSalt } from '#lib/server/ipSalt.ts';

function s(value: unknown): string {
    return typeof value === 'string' ? sanitizeInput(value.trim()) : '';
}

const LINK_SECTIONS = {
    socials: { category: 'social', urlField: 'url' },
    funding: { category: 'funding', urlField: 'url' },
    contact: { category: 'contact', urlField: 'href' }
} as const;

function mapExperience(items: any[]): any[] {
    return items.map((item, idx) => ({
        title: s(item?.title),
        type: s(item?.type),
        company: s(item?.company),
        start_month: s(item?.startMonth),
        start_year: Number(item?.startYear) || new Date().getFullYear(),
        end_month:
            item?.currentlyIn ? null
            : item?.endMonth ? s(item.endMonth)
            : null,
        end_year: item?.currentlyIn ? null : Number(item?.endYear) || null,
        currently_in: Boolean(item?.currentlyIn),
        location: s(item?.location),
        loc_type: s(item?.locType),
        description: s(item?.description),
        sort_order: idx + 1
    }));
}

function mapEducation(items: any[]): any[] {
    return items.map((item, idx) => ({
        institution: s(item?.institution),
        degree: s(item?.degree),
        field: s(item?.field),
        start_month: s(item?.startMonth) || 'September',
        start_year: Number(item?.startYear) || new Date().getFullYear(),
        end_month:
            item?.currentlyIn ? null
            : item?.endMonth ? s(item.endMonth)
            : null,
        end_year: item?.currentlyIn ? null : Number(item?.endYear) || null,
        currently_in: Boolean(item?.currentlyIn),
        grade: s(item?.grade),
        description: s(item?.description),
        sort_order: idx + 1
    }));
}

export const POST: RequestHandler = async ({ request, url, platform, getClientAddress }) => {
    if (!isSameOriginRequest(request, url))
        return apiError(403, 'FORBIDDEN_ORIGIN', 'Cross-origin requests are forbidden.');
    const authError = await requireAdminAuth(request, platform);
    if (authError) return authError;

    const db = getSupabaseAdminClient(platform);

    const { service } = dataStores(platform);
    if (!db || !service)
        return apiError(503, 'PROFILE_IMPORT_UNAVAILABLE', 'Profile storage is unavailable.');

    let body: any;
    try {
        body = await request.json();
    } catch {
        return apiError(400, 'PROFILE_IMPORT_INVALID_INPUT', 'Invalid JSON body.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body))
        return apiError(400, 'PROFILE_IMPORT_INVALID_INPUT', 'Invalid import payload.');

    const store = service.adminAuthor;
    const writer = service.authorWriter;
    let current;
    try {
        current = await store.profileRecord();
    } catch {
        return apiError(503, 'PROFILE_IMPORT_UNAVAILABLE', 'Profile storage is unavailable.');
    }
    if (!current?.id) return apiError(404, 'PROFILE_NOT_FOUND', 'No profile to import into.');
    const authorId = current.id;

    const applied: string[] = [];
    const errors: Record<string, string> = {};

    if (body.profile && typeof body.profile === 'object') {
        try {
            const p = body.profile;
            const patch: Record<string, unknown> = {
                id: authorId,
                revision: current.profile_revision
            };
            if (p.name !== undefined) patch.name = s(p.name);
            if (p.pronunciation !== undefined) patch.pronunciation = p.pronunciation;
            if (p.username !== undefined) patch.username = s(p.username);
            if (p.email !== undefined) patch.email = s(p.email);
            if (p.headline !== undefined) patch.headline = s(p.headline);
            if (p.jobTitle !== undefined) patch.job_title = s(p.jobTitle);
            if (p.bio !== undefined) patch.bio = s(p.bio);
            if (p.city !== undefined) patch.city = s(p.city);
            if (p.postalCode !== undefined) patch.postal_code = s(p.postalCode);
            if (p.country !== undefined) patch.country = s(p.country);
            if (p.siteUrl !== undefined) patch.site_url = s(p.siteUrl);
            const payload = profilePatch(patch, current);
            const saved = await store.saveProfile(payload, null);
            if (saved.status === 'failed') throw new Error(saved.message);
            applied.push('profile');
        } catch (err) {
            errors.profile =
                err instanceof ProfileInputError ? Object.values(err.fields)[0]
                : err instanceof Error ? err.message
                : 'Invalid profile data.';
        }
    }

    if (body.cv && typeof body.cv === 'object') {
        try {
            const hasExperience = Array.isArray(body.cv.experience);
            const hasEducation = Array.isArray(body.cv.education);
            if (hasExperience || hasEducation) {
                const stored = hasExperience && hasEducation ? null : await store.cvEntries();
                const result = await writer.saveCv(
                    authorId,
                    mapExperience(hasExperience ? body.cv.experience : stored!.experience),
                    mapEducation(hasEducation ? body.cv.education : stored!.education)
                );
                if (result.status === 'rejected') throw new Error(result.message);
                applied.push('cv');
            }
        } catch (err) {
            errors.cv = err instanceof Error ? err.message : 'Invalid CV data.';
        }
    }

    if (Array.isArray(body.skills)) {
        try {
            const categories = body.skills.map((item: any, idx: number) => ({
                category: s(item?.category),
                sort_order: idx + 1,
                skills:
                    Array.isArray(item?.items) ?
                        item.items.map((skill: unknown) => s(skill)).filter(Boolean)
                    :   []
            }));
            const result = await writer.saveSkills(authorId, categories);
            if (result.status === 'rejected') throw new Error(result.message);
            applied.push('skills');
        } catch (err) {
            errors.skills = err instanceof Error ? err.message : 'Invalid skills data.';
        }
    }

    for (const [section, { category, urlField }] of Object.entries(LINK_SECTIONS)) {
        if (!Array.isArray(body[section])) continue;
        try {
            const items = body[section].map((item: any, idx: number) => ({
                platform: s(item?.platform),
                display_value: item?.displayValue !== undefined ? s(item.displayValue) : null,
                url: s(item?.[urlField]),
                icon: s(item?.icon),
                description: s(item?.description),
                sort_order: idx + 1
            }));
            const result = await writer.saveLinks(authorId, category, items);
            if (result.status === 'rejected') throw new Error(result.message);
            applied.push(section);
        } catch (err) {
            errors[section] = err instanceof Error ? err.message : `Invalid ${section} data.`;
        }
    }

    if (!applied.length && !Object.keys(errors).length)
        return apiError(
            400,
            'PROFILE_IMPORT_EMPTY',
            'No recognized sections (profile, cv, skills, funding, contact, socials) found in the file.'
        );

    const token = bearerToken(request);
    const actor = token ? (await db.auth.getUser(token)).data.user?.email : null;
    await logActivity(
        {
            actor: actor ?? null,
            action: 'profile.import',
            category: 'profile',
            summary: `Imported ${applied.join(', ') || 'nothing'}${Object.keys(errors).length ? `; failed: ${Object.keys(errors).join(', ')}` : ''}.`,
            details: { applied, errors },
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
        service.activityLog
    );

    return Response.json(
        { success: true, applied, errors },
        { headers: { 'Cache-Control': 'no-store' } }
    );
};
