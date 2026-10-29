import type { ResumeDocument } from '@idstead/domain/author.ts';
import { generateAuthorMarkdown, sanitizePublicApiData } from '#lib/authorApi.ts';
import { buildResumeBundle } from '#lib/server/resumeBundle.ts';
import {
    RESUME_CHECKSUM_ALGORITHMS,
    resumeBundleFilename,
    resumeDocumentInfo,
    resumeDocumentMarkdown,
    type ResumeChecksumExt,
    type ResumeChecksums
} from '#lib/resumeVerification.ts';
import type { ApiContext } from './blog';
import {
    ApiRequestError,
    RESUME_FILE_OUTPUTS,
    parseApiParams,
    parseBoolean,
    resolveOutput,
    type ApiParam,
    type ResumeFileOutput
} from './params';
import { jsonResponse, textResponse } from './responses';

export const AUTHOR_FIELDS = [
    'profile',
    'contact',
    'resume',
    'funding',
    'skills',
    'socials'
] as const;
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
        profile: () => ctx.repos.author.profile({ includeEmail: true }),
        contact: () => ctx.repos.author.contactLinks(),
        resume: () => ctx.repos.author.resumeEntries(),
        funding: () => ctx.repos.author.fundingLinks(),
        skills: () => ctx.repos.author.skillGroups(),
        socials: () => ctx.repos.author.socialLinks()
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

const DIGESTS = { 'sha-256': 'SHA-256', 'sha-512': 'SHA-512' } as const;
type DigestName = keyof typeof DIGESTS;

function wantedDigests(header: string | null): DigestName[] {
    const all = Object.keys(DIGESTS) as DigestName[];
    if (!header) return all;
    const wanted = header
        .split(',')
        .map(member => {
            const [name, weight] = member.trim().split('=');
            return { name: name.trim().toLowerCase(), weight: Number(weight ?? 1) };
        })
        .filter(
            (item): item is { name: DigestName; weight: number } =>
                item.name in DIGESTS && Number.isFinite(item.weight) && item.weight > 0
        )
        .sort((a, b) => b.weight - a.weight)
        .map(item => item.name);
    return wanted.length ? wanted : all;
}

async function digestHeaders(bytes: ArrayBuffer, request: Request) {
    const digests = await Promise.all(
        wantedDigests(request.headers.get('want-repr-digest')).map(async name => {
            const digest = new Uint8Array(await crypto.subtle.digest(DIGESTS[name], bytes));
            return {
                name,
                hex: Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join(''),
                base64: btoa(String.fromCharCode(...digest))
            };
        })
    );
    const headers: Record<string, string> = {
        'Repr-Digest': digests.map(digest => `${digest.name}=:${digest.base64}:`).join(', ')
    };
    const sha256 = digests.find(digest => digest.name === 'sha-256');
    if (sha256) headers['X-Checksum-SHA256'] = sha256.hex;
    return headers;
}

const FILE_CACHE = 'public, max-age=0, s-maxage=60, must-revalidate';

async function readStored(ctx: ApiContext, url: string, missing: ApiRequestError | null) {
    let response: Response;
    try {
        response = await ctx.fetch(url);
    } catch {
        throw new ApiRequestError(502, 'RESUME_FETCH_FAILED', 'Failed to fetch resume file.');
    }
    if (missing && (response.status === 404 || response.status === 403)) throw missing;
    if (!response.ok)
        throw new ApiRequestError(502, 'RESUME_FETCH_FAILED', 'Failed to fetch resume file.');
    return response.arrayBuffer();
}

async function assembleBundle(
    ctx: ApiContext,
    document: ResumeDocument & { checksums: ResumeChecksums },
    filename: string
) {
    const [key, profile] = await Promise.all([
        ctx.repos.author.activeOpenPgpKey(),
        ctx.repos.author.profile()
    ]).catch(() => {
        throw new ApiRequestError(
            500,
            'RESUME_METADATA_FETCH_FAILED',
            'Could not fetch resume metadata.'
        );
    });
    const signed = Boolean(
        document.signedAt && key && document.signerFingerprint === key.fingerprint
    );
    const signatureMissing = new ApiRequestError(
        404,
        'RESUME_BUNDLE_NOT_FOUND',
        'The verification bundle for this resume has not been built yet.'
    );
    const pdf = new Uint8Array(await readStored(ctx, document.fileUrl, null));
    const signature =
        signed ?
            {
                asc: new TextDecoder().decode(
                    await readStored(ctx, `${document.fileUrl}.asc`, signatureMissing)
                ),
                sig: new Uint8Array(
                    await readStored(ctx, `${document.fileUrl}.sig`, signatureMissing)
                )
            }
        :   null;
    const zip = buildResumeBundle({
        filename,
        pdf,
        checksumFiles: Object.fromEntries(
            RESUME_CHECKSUM_ALGORITHMS.map(({ ext }) => [
                ext,
                `${document.checksums[ext]}  ${filename}\n`
            ])
        ) as Record<ResumeChecksumExt, string>,
        signature,
        publicKey: key?.armored ?? null,
        key,
        siteUrl: profile?.siteUrl || '',
        apiBase: ctx.url.origin,
        date: new Date(document.signedAt ?? document.updatedAt ?? 0)
    });
    return zip.slice().buffer;
}

async function resumeFile(ctx: ApiContext, output: ResumeFileOutput, withChecksum: boolean) {
    let document;
    try {
        document = await ctx.repos.author.activeResumeDocument();
    } catch {
        throw new ApiRequestError(
            500,
            'RESUME_METADATA_FETCH_FAILED',
            'Could not fetch resume metadata.'
        );
    }
    if (!document?.fileUrl)
        throw new ApiRequestError(404, 'RESUME_DOCUMENT_NOT_FOUND', 'Resume document not found.');

    const filename = (document.filename || 'resume.pdf').replace(/["\\\r\n]/g, '');
    const signatureMissing = new ApiRequestError(
        404,
        'RESUME_SIGNATURE_NOT_FOUND',
        'This version of the resume is not signed yet.'
    );
    let body: ArrayBuffer | string;
    let type: string;
    let name: string;

    if (output === 'pdf') {
        body = await readStored(ctx, document.fileUrl, null);
        type = 'application/pdf';
        name = filename;
    } else if (output === 'zip') {
        const missing = new ApiRequestError(
            404,
            'RESUME_BUNDLE_NOT_FOUND',
            'The verification bundle for this resume has not been built yet.'
        );
        try {
            body = await readStored(
                ctx,
                document.fileUrl.replace(/[^/]+$/, resumeBundleFilename(filename)),
                missing
            );
        } catch (error) {
            if (error !== missing || !document.checksums) throw error;
            body = await assembleBundle(
                ctx,
                { ...document, checksums: document.checksums },
                filename
            );
        }
        type = 'application/zip';
        name = resumeBundleFilename(filename);
    } else if (output === 'asc' || output === 'sig') {
        const key = await ctx.repos.author.activeOpenPgpKey().catch(() => {
            throw new ApiRequestError(
                500,
                'RESUME_METADATA_FETCH_FAILED',
                'Could not fetch resume metadata.'
            );
        });
        if (!document.signedAt || !key || document.signerFingerprint !== key.fingerprint)
            throw signatureMissing;
        body = await readStored(ctx, `${document.fileUrl}.${output}`, signatureMissing);
        type = output === 'asc' ? 'application/pgp-signature' : 'application/octet-stream';
        name = `${filename}.${output}`;
    } else {
        const ext = output as ResumeChecksumExt;
        const digest = document.checksums?.[ext];
        body =
            digest ?
                `${digest}  ${filename}\n`
            :   await readStored(ctx, `${document.fileUrl}.${ext}`, null);
        type = 'text/plain; charset=utf-8';
        name = `${filename}.${ext}`;
    }

    const headers: Record<string, string> = {
        'Content-Type': type,
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': FILE_CACHE
    };
    if (withChecksum && typeof body !== 'string') {
        Object.assign(headers, await digestHeaders(body, ctx.request));
        headers.Vary = 'Want-Repr-Digest';
    }
    return new Response(body, { headers });
}

async function resumeDocumentFor(ctx: ApiContext) {
    try {
        const [document, key, profile] = await Promise.all([
            ctx.repos.author.activeResumeDocument(),
            ctx.repos.author.activeOpenPgpKey(),
            ctx.repos.author.profile()
        ]);
        if (!document?.fileUrl) return null;
        return resumeDocumentInfo(document, key, profile?.siteUrl || '', ctx.url.origin);
    } catch {
        return null;
    }
}

export async function getAuthor(ctx: ApiContext, fixedFields?: readonly AuthorField[]) {
    const allowed: ApiParam[] =
        fixedFields ? ['output', 'checksum'] : ['field', 'output', 'checksum'];
    const params = parseApiParams(ctx.url, allowed);
    const fields = fixedFields ? [...fixedFields] : requestedFields(params.getAll('field'));
    const resumeOnly = fields.length === 1 && fields[0] === 'resume';
    const output = resolveOutput(
        params,
        ctx.request,
        resumeOnly ? ['json', 'md', ...RESUME_FILE_OUTPUTS] : ['json', 'md'],
        'json'
    );

    if (params.has('checksum') && output !== 'pdf' && output !== 'zip')
        throw new ApiRequestError(
            400,
            'RESUME_CHECKSUM_REQUIRES_PDF',
            'The checksum parameter only applies to the resume PDF and its verification bundle.',
            "Add 'output=pdf' or 'output=zip', or remove 'checksum'."
        );
    if ((RESUME_FILE_OUTPUTS as readonly string[]).includes(output))
        return resumeFile(ctx, output as ResumeFileOutput, parseBoolean(params, 'checksum', true));

    const load = loaders(ctx);
    let raw: Record<string, unknown>;
    let resumeDocument: Awaited<ReturnType<typeof resumeDocumentFor>>;
    try {
        const [values, document] = await Promise.all([
            Promise.all(fields.map(field => load[field]())),
            fields.includes('resume') ? resumeDocumentFor(ctx) : null
        ]);
        raw = Object.fromEntries(fields.map((field, index) => [field, values[index]]));
        resumeDocument = document;
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

    if (fields.includes('resume'))
        data.resume = { ...((data.resume as object | undefined) ?? {}), document: resumeDocument };

    if (output === 'md')
        return textResponse(
            generateAuthorMarkdown(data)
                + (resumeDocument ? `\n${resumeDocumentMarkdown(resumeDocument)}` : ''),
            'md'
        );
    return jsonResponse(data);
}
