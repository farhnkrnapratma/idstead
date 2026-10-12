import {
    fetchActiveCvDocument,
    fetchAuthorProfile,
    fetchContactInfo,
    fetchCvEntries,
    fetchFundingLinks,
    fetchGroupedSkills,
    fetchSocials
} from '#lib/author.ts';
import { generateAuthorMarkdown, sanitizePublicApiData } from '#lib/authorApi.ts';
import type { ApiContext } from './blog';
import {
    ApiRequestError,
    parseApiParams,
    parseBoolean,
    resolveOutput,
    type ApiParam
} from './params';
import { jsonResponse, textResponse } from './responses';

export const AUTHOR_FIELDS = ['profile', 'contact', 'cv', 'funding', 'skills', 'socials'] as const;
export type AuthorField = (typeof AUTHOR_FIELDS)[number];

const PROFILE_ORDER = [
    'name',
    'pronunciation',
    'username',
    'email',
    'headline',
    'jobTitle',
    'bio',
    'avatar',
    'city',
    'postalCode',
    'country',
    'siteUrl'
];

function loaders(ctx: ApiContext): Record<AuthorField, () => Promise<unknown>> {
    return {
        profile: () => fetchAuthorProfile(ctx.db, { includeEmail: true, strict: true }),
        contact: () => fetchContactInfo(ctx.db, { strict: true }),
        cv: () => fetchCvEntries(ctx.db, { strict: true }),
        funding: () => fetchFundingLinks(ctx.db, { strict: true }),
        skills: () => fetchGroupedSkills(ctx.db, { strict: true }),
        socials: () => fetchSocials(ctx.db, { strict: true })
    };
}

function requestedFields(values: string[]): AuthorField[] {
    const unknown = values.filter(value => !(AUTHOR_FIELDS as readonly string[]).includes(value));
    if (unknown.length)
        throw new ApiRequestError(
            400,
            'AUTHOR_FIELD_INVALID',
            'The request asks for an author field that does not exist.',
            `Unknown field '${unknown[0]}'. Fields: ${AUTHOR_FIELDS.join(', ')}.`
        );
    return values.length ? (values as AuthorField[]) : [...AUTHOR_FIELDS];
}

function publicAssetUrl(value: unknown) {
    if (typeof value !== 'string' || !value) return value;
    try {
        const url = new URL(value);
        url.searchParams.delete('v');
        return url.toString();
    } catch {
        return value;
    }
}

function orderProfile(profile: Record<string, unknown>, email: unknown) {
    const ordered: Record<string, unknown> = {};
    for (const key of PROFILE_ORDER) {
        if (key === 'email') {
            if (typeof email === 'string' && email) ordered.email = email;
        } else if (key === 'avatar') {
            if (key in profile) ordered.avatar = publicAssetUrl(profile.avatar);
        } else if (key in profile) ordered[key] = profile[key];
    }
    for (const [key, value] of Object.entries(profile)) if (!(key in ordered)) ordered[key] = value;
    return ordered;
}

async function sha256(bytes: ArrayBuffer) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return {
        hex: Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join(''),
        base64: btoa(String.fromCharCode(...digest))
    };
}

async function cvPdf(ctx: ApiContext, withChecksum: boolean) {
    let document;
    try {
        document = await fetchActiveCvDocument(ctx.db, ctx.fetch, { strict: true });
    } catch {
        throw new ApiRequestError(500, 'CV_METADATA_FETCH_FAILED', 'Could not fetch CV metadata.');
    }
    if (!document?.fileUrl)
        throw new ApiRequestError(404, 'CV_DOCUMENT_NOT_FOUND', 'CV document not found.');

    let bytes: ArrayBuffer;
    try {
        const response = await ctx.fetch(document.fileUrl);
        if (!response.ok) throw new Error(`CV storage returned ${response.status}`);
        bytes = await response.arrayBuffer();
    } catch {
        throw new ApiRequestError(502, 'CV_FETCH_FAILED', 'Failed to fetch CV file.');
    }

    const filename = (document.filename || 'cv.pdf').replace(/["\\\r\n]/g, '');
    const headers: Record<string, string> = {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate'
    };
    if (withChecksum) {
        const digest = await sha256(bytes);
        headers['Repr-Digest'] = `sha-256=:${digest.base64}:`;
        headers['X-Checksum-SHA256'] = digest.hex;
    }
    return new Response(bytes, { headers });
}

export async function getAuthor(ctx: ApiContext, fixedFields?: readonly AuthorField[]) {
    const allowed: ApiParam[] =
        fixedFields ? ['output', 'checksum'] : ['field', 'output', 'checksum'];
    const params = parseApiParams(ctx.url, allowed);
    const fields = fixedFields ? [...fixedFields] : requestedFields(params.getAll('field'));
    const cvOnly = fields.length === 1 && fields[0] === 'cv';
    const output = resolveOutput(
        params,
        ctx.request,
        cvOnly ? ['json', 'md', 'pdf'] : ['json', 'md'],
        'json'
    );

    if (params.has('checksum') && output !== 'pdf')
        throw new ApiRequestError(
            400,
            'CV_CHECKSUM_REQUIRES_PDF',
            'The checksum parameter only applies to the CV PDF.',
            "Add 'output=pdf' or remove 'checksum'."
        );
    if (output === 'pdf') return cvPdf(ctx, parseBoolean(params, 'checksum', true));

    const load = loaders(ctx);
    let raw: Record<string, unknown>;
    try {
        const values = await Promise.all(fields.map(field => load[field]()));
        raw = Object.fromEntries(fields.map((field, index) => [field, values[index]]));
    } catch {
        throw new ApiRequestError(
            500,
            'AUTHOR_FETCH_FAILED',
            'Could not fetch author information.'
        );
    }

    const data = sanitizePublicApiData(raw) as Record<string, unknown>;
    if (data.profile && typeof data.profile === 'object')
        data.profile = orderProfile(
            data.profile as Record<string, unknown>,
            (raw.profile as { email?: unknown } | undefined)?.email
        );

    if (output === 'md') return textResponse(generateAuthorMarkdown(data), 'md');
    return jsonResponse(data);
}
