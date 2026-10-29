import { verifyAdminToken, bearerToken } from './adminAuth';
import * as publicEnv from '$app/env/public';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { dataStores } from '#lib/server/data.ts';
import { supabase as publicSupabase } from '#lib/supabase.ts';
import { clientAddress, logActivity, type ActivityCategory } from '#lib/server/activityLog.ts';
import {
    generateResumePdfBuffer,
    type AuthorResumeData,
    type ExperienceData,
    type EducationData,
    type ProjectData,
    type SkillCategoryData
} from '#lib/server/pdfGenerator.ts';
import { loadResumeFonts } from '#lib/server/resumeFonts.ts';
import { readAvatarBytes } from '#lib/server/profileAssets.ts';
import { fetchProjects } from '#lib/server/githubProjects.ts';
import type { ResumeDocumentStore, StoredResumeDocument } from '@idstead/data';
import {
    resumeSnapshot,
    resumeVersionBump,
    type ResumeSnapshot,
    formatResumeVersion,
    nextResumeVersion,
    parseResumeVersion
} from '#lib/resumeVersion.ts';
import {
    RESUME_CHECKSUM_EXTENSIONS,
    RESUME_SIDECAR_EXTENSIONS,
    RESUME_SIGNATURE_EXTENSIONS,
    RESUME_SIGNATURE_LIMIT,
    resumeBundleKey,
    resumeChecksums,
    resumeKey
} from '#lib/server/resumeChecksums.ts';
import { buildResumeBundle } from '#lib/server/resumeBundle.ts';
import { resumeBundleFilename } from '#lib/resumeVerification.ts';
import { safeKeyserverUrl } from '@idstead/domain/openpgpKey.ts';
import {
    OPENPGP_KEY_LIMIT,
    OpenPgpError,
    parseDetachedSignature,
    readLimited,
    parsePublicKey,
    verifyDetachedSignature,
    verifyKeyserver
} from '#lib/server/openpgp.ts';
import { ipSalt } from './ipSalt';
import { apiError } from './apiError';
import { decodeHtmlEntities } from '@mdrs/core';
import { deleteObjects, findAssetBucket } from './r2';

const RESUME_PROJECT_LIMIT = 4;

function getAdminDb(platform?: unknown) {
    return getSupabaseAdminClient(platform) || publicSupabase;
}

function resumeStores(platform?: unknown) {
    const service = dataStores(platform).service;
    if (!service) throw new Error('Resume storage is unavailable.');
    return {
        db: getAdminDb(platform),
        documents: service.resumeDocuments,
        keys: service.openPgpKeys
    };
}

async function resumeStorage(platform?: any) {
    const rawCdnUrl =
        platform?.env?.PUBLIC_CDN_BASE_URL
        || publicEnv.PUBLIC_CDN_BASE_URL
        || process.env.PUBLIC_CDN_BASE_URL
        || '';
    const cdnUrl = rawCdnUrl.trim().replace(/\/+$/, '');
    const bucket = await findAssetBucket(platform);
    return bucket && cdnUrl ? { bucket, cdnUrl } : null;
}

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

function fail(message: string, status = 500) {
    return apiError(status, 'RESUME_REQUEST_FAILED', message);
}

async function resolveActor(
    req: Request,
    db: ReturnType<typeof getAdminDb>
): Promise<string | null> {
    const token = bearerToken(req);
    if (!token) return null;
    const { data } = await db.auth.getUser(token);
    return data.user?.email ?? data.user?.id ?? null;
}

export async function logAdminActivity(
    req: Request,
    platform: unknown,
    entry: {
        action: string;
        category: ActivityCategory;
        entityId?: string | null;
        summary: string;
    },
    getClientAddress?: () => string
) {
    await logActivity(
        {
            actor: await resolveActor(req, getAdminDb(platform)),
            ...entry,
            ip: clientAddress(getClientAddress),
            ipSalt: ipSalt(platform),
            userAgent: req.headers.get('user-agent') ?? undefined
        },
        dataStores(platform).service?.activityLog
    );
}

function logResumeActivity(
    req: Request,
    platform: unknown,
    action: string,
    entityId: string,
    summary: string,
    getClientAddress?: () => string
) {
    return logAdminActivity(
        req,
        platform,
        { action, category: 'resume', entityId, summary },
        getClientAddress
    );
}

export async function requireAdminAuth(req: Request, platform?: unknown): Promise<Response | null> {
    const auth = await verifyAdminToken(req, getAdminDb(platform));
    if (auth.status)
        return apiError(
            auth.status,
            auth.status === 401 ? 'ADMIN_AUTH_REQUIRED' : 'ADMIN_FORBIDDEN',
            auth.message
        );
    return null;
}

export function formatAuthorSlug(name?: string): string {
    if (!name || !name.trim()) return 'Resume-Profile';
    const cleanName = decodeHtmlEntities(name);
    const words = cleanName
        .trim()
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

    const slug = words.join('_') || 'Profile';
    return `Resume-${slug}`;
}

function resumeObjectKeys(filename: string) {
    return [
        resumeKey(filename),
        ...RESUME_SIDECAR_EXTENSIONS.map(ext => resumeKey(filename, ext)),
        resumeBundleKey(filename),
        filename,
        `${filename}.sha256`
    ];
}

async function putResumeObject(
    platform: unknown,
    key: string,
    body: Uint8Array,
    contentType: string,
    downloadName?: string
) {
    const storage = await resumeStorage(platform);
    if (storage) {
        await storage.bucket.put(key, body, {
            httpMetadata: {
                contentType,
                cacheControl: 'public, max-age=60',
                ...(downloadName ?
                    { contentDisposition: `attachment; filename="${downloadName}"` }
                :   {})
            }
        });
        return;
    }
    throw new Error('Resume files need the asset bucket and PUBLIC_CDN_BASE_URL.');
}

async function deleteResumeObjects(platform: unknown, keys: string[]) {
    const storage = await resumeStorage(platform);
    if (storage) await deleteObjects(storage.bucket, keys);
}

async function fetchBytes(url: string) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Resume storage returned ${response.status} for ${url}`);
    return new Uint8Array(await response.arrayBuffer());
}

async function storedSignature(fileUrl: string) {
    for (const ext of RESUME_SIGNATURE_EXTENSIONS) {
        try {
            const parsed = await parseDetachedSignature(await fetchBytes(`${fileUrl}.${ext}`));
            return { asc: parsed.asc, sig: parsed.sig };
        } catch {
            continue;
        }
    }
    return null;
}

async function siteUrlFor(documents: ResumeDocumentStore, platform: unknown) {
    return (
        (await documents.siteUrl().catch(() => ''))
        || (platform as { env?: { PUBLIC_SITE_URL?: string } } | undefined)?.env?.PUBLIC_SITE_URL
        || (publicEnv as Record<string, string | undefined>).PUBLIC_SITE_URL
        || ''
    ).replace(/\/+$/, '');
}

async function storeResumeSignature(
    platform: unknown,
    filename: string,
    signature: { asc: string; sig: Uint8Array }
) {
    await putResumeObject(
        platform,
        resumeKey(filename, 'asc'),
        new TextEncoder().encode(signature.asc),
        'application/pgp-signature',
        `${filename}.asc`
    );
    await putResumeObject(
        platform,
        resumeKey(filename, 'sig'),
        signature.sig,
        'application/pgp-signature',
        `${filename}.sig`
    );
}

async function clearResumeSignature(
    platform: unknown,
    documents: ResumeDocumentStore,
    doc: StoredResumeDocument
) {
    await deleteResumeObjects(
        platform,
        RESUME_SIGNATURE_EXTENSIONS.map(ext => resumeKey(doc.filename, ext))
    );
    await documents.setSignature(doc.id, null);
}

async function refreshResumeBundle(
    platform: unknown,
    stores: ReturnType<typeof resumeStores>,
    doc: StoredResumeDocument,
    known: { pdf?: Uint8Array; signature?: { asc: string; sig: Uint8Array } | null } = {}
) {
    const pdf = known.pdf ?? (await fetchBytes(doc.file_url));
    const { digests, files } = await resumeChecksums(pdf, doc.filename);
    const signature =
        known.signature !== undefined ? known.signature
        : doc.signed_at ? await storedSignature(doc.file_url)
        : null;
    if (signature && known.signature === undefined)
        await storeResumeSignature(platform, doc.filename, signature);
    const key = await stores.keys.active();
    const bundle = buildResumeBundle({
        filename: doc.filename,
        pdf,
        checksumFiles: files,
        signature,
        publicKey: key?.armored ?? null,
        key,
        siteUrl: await siteUrlFor(stores.documents, platform),
        apiBase:
            (platform as { env?: { PUBLIC_API_BASE_URL?: string } } | undefined)?.env
                ?.PUBLIC_API_BASE_URL || publicEnv.PUBLIC_API_BASE_URL,
        date: new Date()
    });
    await putResumeObject(
        platform,
        resumeBundleKey(doc.filename),
        bundle,
        'application/zip',
        resumeBundleFilename(doc.filename)
    );
    await stores.documents
        .setChecksums(doc.id, digests)
        .catch(error => console.error('Resume checksums could not be saved:', error));
}

async function removeResumeObjects(platform: unknown, filename: string, strict: boolean) {
    const keys = resumeObjectKeys(filename);
    const storage = await resumeStorage(platform);
    if (strict && !storage) return false;
    if (storage) {
        try {
            await deleteObjects(storage.bucket, keys);
        } catch (err) {
            console.error('R2 deletion warning:', err);
            if (strict) return false;
        }
    }
    return true;
}

export async function deleteResumeFile(
    platform: unknown,
    documents: ResumeDocumentStore,
    filename: string,
    strict = false
): Promise<boolean> {
    if (!(await removeResumeObjects(platform, filename, strict))) return false;
    return documents.delete(filename);
}

export async function processResumeGenerate(
    req: Request,
    platform?: unknown,
    getClientAddress?: () => string
): Promise<Response> {
    try {
        const authError = await requireAdminAuth(req, platform);
        if (authError) return authError;

        const stores = resumeStores(platform);
        const { documents } = stores;

        let force = false;
        try {
            const body = await req.json();
            force = body?.force === true;
        } catch {
            force = false;
        }

        let source;
        try {
            source = await documents.sourceData();
        } catch (loadError) {
            console.error('Resume data query failed:', loadError);
            return fail('Failed to load resume data.');
        }
        if (!source)
            return apiError(404, 'RESUME_NOT_FOUND', 'Author profile not found in database.');
        const { profile, socials, repoRules } = source;
        const experiences = source.experiences as unknown as ExperienceData[];
        const educations = source.educations as unknown as EducationData[];
        const skillCategories: SkillCategoryData[] = source.skills;

        const repositories = await fetchProjects(fetch, platform, repoRules.excluded);
        const pinned = new Set(repoRules.pinned.map(name => name.toLowerCase()));
        const projects: ProjectData[] = [...repositories]
            .sort(
                (a, b) =>
                    Number(pinned.has(b.name.toLowerCase()))
                        - Number(pinned.has(a.name.toLowerCase()))
                    || b.stars - a.stars
                    || (b.pushedAt ?? '').localeCompare(a.pushedAt ?? '')
            )
            .slice(0, RESUME_PROJECT_LIMIT)
            .map(repo => ({ name: repo.name, url: repo.url, desc: repo.desc, lang: repo.lang }));

        const resumeData: AuthorResumeData = {
            profile: {
                name: String(profile.name || ''),
                title: String(profile.job_title || profile.headline || ''),
                bio: String(profile.bio || ''),
                email: String(profile.email || ''),
                website: String(profile.site_url || ''),
                location: [profile.city, profile.country].filter(Boolean).join(', '),
                avatarBytes: await readAvatarBytes(
                    platform as Pick<App.Platform, 'env'> | undefined,
                    profile.avatar_version
                )
            },
            links: socials
                .filter(item => /github|linkedin/i.test(item.platform))
                .map(item => ({ url: item.url })),
            experiences,
            projects,
            educations,
            skills: skillCategories
        };

        const snapshot = resumeSnapshot({
            profile: { ...resumeData.profile },
            avatar: profile.avatar_version ?? null,
            links: resumeData.links.map(link => link.url),
            experiences: source.experiences,
            educations: source.educations,
            skills: skillCategories,
            projects
        });

        const activeDoc = await documents.active();
        const previousSnapshot = activeDoc ? await documents.snapshot(activeDoc.id) : null;

        let bump =
            activeDoc ?
                resumeVersionBump((previousSnapshot as ResumeSnapshot | null) ?? null, snapshot)
            :   null;
        if (activeDoc && !bump && !force)
            return jsonResponse({
                success: true,
                upToDate: true,
                filename: activeDoc.filename,
                version: formatResumeVersion(
                    parseResumeVersion(activeDoc.filename) ?? { major: 1, minor: 0 }
                )
            });
        if (activeDoc && !bump) bump = { level: 'minor', reasons: ['Regenerated on request'] };
        const version =
            activeDoc ?
                nextResumeVersion(parseResumeVersion(activeDoc.filename), bump!.level)
            :   { major: 1, minor: 0 };
        const reasons = activeDoc ? bump!.reasons : ['First version'];
        const versionLabel = formatResumeVersion(version);

        const r2Storage = await resumeStorage(platform);
        const pdfBytes = await generateResumePdfBuffer(resumeData, loadResumeFonts());
        const shortHash = Array.from(
            new Uint8Array(
                await crypto.subtle.digest('SHA-256', new Uint8Array(pdfBytes))
            ).subarray(0, 4),
            byte => byte.toString(16).padStart(2, '0')
        )
            .join('')
            .slice(0, 7);
        const filename = `${formatAuthorSlug(String(profile.name || ''))}-${shortHash}-v${versionLabel}.pdf`;
        const { digests, files: checksumFiles } = await resumeChecksums(pdfBytes, filename);

        for (const oldFilename of await documents.activeFilenames())
            if (oldFilename !== filename) await removeResumeObjects(platform, oldFilename, false);

        let fileUrl = '';
        const uploads: [string, Uint8Array, string][] = [
            [resumeKey(filename), pdfBytes, 'application/pdf'],
            ...RESUME_CHECKSUM_EXTENSIONS.map(
                ext =>
                    [
                        resumeKey(filename, ext),
                        new TextEncoder().encode(checksumFiles[ext]),
                        'text/plain; charset=utf-8'
                    ] as [string, Uint8Array, string]
            )
        ];

        if (r2Storage) {
            try {
                for (const [key, body, contentType] of uploads)
                    await r2Storage.bucket.put(key, body, {
                        httpMetadata: { contentType, cacheControl: 'public, max-age=300' }
                    });
                fileUrl = `${r2Storage.cdnUrl}/${resumeKey(filename)}`;
            } catch (r2Err) {
                console.error('Resume upload to R2 failed:', r2Err);
            }
        }

        if (!fileUrl) return fail('Failed to upload resume file.');

        let inserted: { id: string };
        try {
            inserted = await documents.publish(
                {
                    authorId: profile.id,
                    filename,
                    fileUrl,
                    hash: digests.sha256,
                    checksums: digests,
                    version: versionLabel
                },
                snapshot
            );
        } catch (insertError) {
            console.error('Resume record could not be saved:', insertError);
            return fail('Failed to save resume record.');
        }

        try {
            await refreshResumeBundle(
                platform,
                stores,
                { id: inserted.id, filename, file_url: fileUrl, signed_at: null },
                { pdf: pdfBytes, signature: null }
            );
        } catch (bundleError) {
            console.error('Resume verification bundle could not be built:', bundleError);
        }

        await logResumeActivity(
            req,
            platform,
            'resume.upload',
            filename,
            `Generated resume document v${versionLabel} (${reasons.join(', ')}).`,
            getClientAddress
        );

        return jsonResponse(
            {
                success: true,
                filename,
                fileUrl,
                hash: digests.sha256,
                checksums: digests,
                version: versionLabel,
                level: activeDoc ? bump!.level : 'major',
                reasons
            },
            200
        );
    } catch (err: any) {
        console.error('Unhandled processResumeGenerate error:', err);
        return fail('Failed to auto-generate resume document.');
    }
}

export async function processResumeUpload(
    req: Request,
    platform?: unknown,
    getClientAddress?: () => string
): Promise<Response> {
    return processResumeGenerate(req, platform, getClientAddress);
}

export async function processResumeDelete(
    req: Request,
    platform?: unknown,
    getClientAddress?: () => string
): Promise<Response> {
    try {
        const authError = await requireAdminAuth(req, platform);
        if (authError) return authError;

        const { documents } = resumeStores(platform);
        let targetFilename: string | null = null;
        try {
            const body = await req.json();
            if (typeof body?.filename === 'string' && body.filename.trim()) {
                targetFilename = body.filename.trim();
            }
        } catch {
            targetFilename = null;
        }

        let filename: string;
        if (targetFilename) {
            const found = await documents.findFilename(targetFilename).catch(() => null);
            if (!found) return apiError(404, 'RESUME_NOT_FOUND', 'Resume document not found.');
            filename = found;
        } else {
            const active = await documents.active().catch(() => null);
            if (!active)
                return apiError(404, 'RESUME_NOT_FOUND', 'No active resume document to delete.');
            filename = active.filename;
        }

        const deleted = await deleteResumeFile(platform, documents, filename);
        if (!deleted) {
            return fail('Failed to remove resume record.');
        }

        await logResumeActivity(
            req,
            platform,
            'resume.delete',
            filename,
            'Deleted resume document.',
            getClientAddress
        );

        return jsonResponse({ success: true, filename }, 200);
    } catch (err: any) {
        console.error('Unhandled processResumeDelete error:', err);
        return fail('Failed to delete resume document.');
    }
}

function openPgpFailure(err: unknown, fallback: string) {
    if (err instanceof OpenPgpError) return apiError(422, 'OPENPGP_KEY_INVALID', err.message);
    console.error(fallback, err);
    return fail(fallback);
}

export async function processResumeSignature(
    req: Request,
    platform?: unknown,
    getClientAddress?: () => string
): Promise<Response> {
    try {
        const authError = await requireAdminAuth(req, platform);
        if (authError) return authError;
        const stores = resumeStores(platform);
        const { documents, keys } = stores;
        const doc = await documents.active();
        if (!doc) return apiError(404, 'RESUME_NOT_FOUND', 'No active resume document.');

        if (req.method === 'DELETE') {
            await clearResumeSignature(platform, documents, doc);
            await refreshResumeBundle(
                platform,
                stores,
                { ...doc, signed_at: null },
                { signature: null }
            );
            await logResumeActivity(
                req,
                platform,
                'resume.signature_delete',
                doc.filename,
                'Removed the resume signature.',
                getClientAddress
            );
            return jsonResponse({ success: true, signedAt: null, signerFingerprint: null });
        }

        if (Number(req.headers.get('content-length')) > RESUME_SIGNATURE_LIMIT)
            return apiError(413, 'RESUME_UPLOAD_TOO_LARGE', 'Signature files are at most 16 KiB.');
        let upload: Uint8Array;
        try {
            upload = await readLimited(req.body, RESUME_SIGNATURE_LIMIT);
        } catch {
            return apiError(413, 'RESUME_UPLOAD_TOO_LARGE', 'Signature files are at most 16 KiB.');
        }
        const activeKey = await keys.active();
        if (!activeKey)
            return apiError(
                409,
                'OPENPGP_KEY_REQUIRED',
                'Add your OpenPGP public key before uploading a signature.'
            );
        const { key } = await parsePublicKey(new TextEncoder().encode(activeKey.armored));
        const signature = await parseDetachedSignature(upload);
        const pdf = await fetchBytes(doc.file_url);
        await verifyDetachedSignature(pdf, signature.signature, key);

        const files = { asc: signature.asc, sig: signature.sig };
        await storeResumeSignature(platform, doc.filename, files);
        const signedAt = new Date().toISOString();
        await documents.setSignature(doc.id, { signedAt, fingerprint: activeKey.fingerprint });
        await refreshResumeBundle(
            platform,
            stores,
            { ...doc, signed_at: signedAt },
            { pdf, signature: files }
        );
        await logResumeActivity(
            req,
            platform,
            'resume.signature_upload',
            doc.filename,
            `Uploaded a verified resume signature from ${activeKey.fingerprint}.`,
            getClientAddress
        );
        return jsonResponse({ success: true, signedAt, signerFingerprint: activeKey.fingerprint });
    } catch (err) {
        return openPgpFailure(err, 'Failed to update the resume signature.');
    }
}

function base64Bytes(value: string) {
    try {
        return Uint8Array.from(atob(value), char => char.charCodeAt(0));
    } catch {
        throw new OpenPgpError('This file is not an OpenPGP public key.');
    }
}

function requestedKeyservers(value: unknown) {
    if (!Array.isArray(value)) return [];
    if (value.length > 8) throw new OpenPgpError('Use at most 8 keyservers.');
    const seen = new Set<string>();
    return value.flatMap(item => {
        const raw = typeof item?.url === 'string' ? item.url.trim() : '';
        if (!raw) return [];
        const url = safeKeyserverUrl(raw);
        if (!url)
            throw new OpenPgpError(
                `${raw.slice(0, 80)} is not a plain https:// URL without quotes, spaces or credentials.`
            );
        if (seen.has(url)) return [];
        seen.add(url);
        const label =
            typeof item?.label === 'string' && item.label.trim() ?
                item.label.trim().slice(0, 80)
            :   new URL(url).host;
        return [{ label, url }];
    });
}

export async function processOpenPgpKey(
    req: Request,
    platform?: unknown,
    getClientAddress?: () => string
): Promise<Response> {
    try {
        const authError = await requireAdminAuth(req, platform);
        if (authError) return authError;
        const stores = resumeStores(platform);
        const { documents, keys } = stores;
        const existing = await keys.active();
        const doc = await documents.active();

        if (req.method === 'DELETE') {
            try {
                await keys.removeActive();
            } catch {
                return fail('Failed to remove the OpenPGP key.');
            }
            if (doc) {
                if (doc.signed_at) await clearResumeSignature(platform, documents, doc);
                await refreshResumeBundle(
                    platform,
                    stores,
                    { ...doc, signed_at: null },
                    { signature: null }
                );
            }
            await logResumeActivity(
                req,
                platform,
                'resume.openpgp_key_delete',
                existing?.fingerprint ?? 'openpgp-key',
                'Removed the OpenPGP public key.',
                getClientAddress
            );
            return jsonResponse({
                success: true,
                key: null,
                signatureCleared: Boolean(doc?.signed_at)
            });
        }

        if (Number(req.headers.get('content-length')) > OPENPGP_KEY_LIMIT * 2)
            return apiError(413, 'RESUME_UPLOAD_TOO_LARGE', 'Public keys must be at most 64 KiB.');
        let body: any;
        try {
            body = JSON.parse(
                new TextDecoder().decode(await readLimited(req.body, OPENPGP_KEY_LIMIT * 2))
            );
        } catch (err) {
            return err instanceof RangeError ?
                    apiError(413, 'RESUME_UPLOAD_TOO_LARGE', 'Public keys must be at most 64 KiB.')
                :   apiError(400, 'RESUME_INVALID_REQUEST', 'Invalid request body.');
        }
        const upload =
            typeof body?.key?.armored === 'string' ? new TextEncoder().encode(body.key.armored)
            : typeof body?.key?.base64 === 'string' ? base64Bytes(body.key.base64)
            : existing ? new TextEncoder().encode(existing.armored)
            : null;
        if (!upload)
            return apiError(400, 'RESUME_INVALID_REQUEST', 'Upload your OpenPGP public key.');
        const parsed = await parsePublicKey(upload);
        const keyservers = requestedKeyservers(body?.keyservers);
        const failures = (
            await Promise.allSettled(
                keyservers.map(server => verifyKeyserver(server.url, parsed.fingerprint))
            )
        ).flatMap(result =>
            result.status === 'rejected' ?
                [result.reason instanceof Error ? result.reason.message : 'Keyserver check failed.']
            :   []
        );
        if (failures.length) return apiError(422, 'RESUME_INVALID_INPUT', failures.join(' '));

        try {
            await keys.publish({
                fingerprint: parsed.fingerprint,
                armored: parsed.armored,
                userIds: parsed.userIds,
                algorithm: parsed.algorithm,
                createdAt: parsed.createdAt,
                expiresAt: parsed.expiresAt,
                keyservers
            });
        } catch {
            return fail('Failed to save the OpenPGP key.');
        }

        const signer = doc ? await documents.signerFingerprint(doc.id) : null;
        const signatureCleared = Boolean(doc?.signed_at && signer !== parsed.fingerprint);
        if (doc) {
            if (signatureCleared) await clearResumeSignature(platform, documents, doc);
            await refreshResumeBundle(
                platform,
                stores,
                { ...doc, signed_at: signatureCleared ? null : doc.signed_at },
                signatureCleared ? { signature: null } : {}
            );
        }
        await logResumeActivity(
            req,
            platform,
            'resume.openpgp_key',
            parsed.fingerprint,
            existing?.fingerprint === parsed.fingerprint ?
                'Updated the OpenPGP key keyservers.'
            :   `Published OpenPGP key ${parsed.fingerprint}.`,
            getClientAddress
        );
        const { key: _key, ...publicKey } = parsed;
        return jsonResponse({ success: true, key: { ...publicKey, keyservers }, signatureCleared });
    } catch (err) {
        return openPgpFailure(err, 'Failed to update the OpenPGP key.');
    }
}
