import { S3Client, PutObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { verifyAdminToken, bearerToken } from './adminAuth';
import * as privateEnv from '$app/env/private';
import * as publicEnv from '$app/env/public';
import { getSupabaseAdminClient } from '#lib/server/supabaseAdmin.ts';
import { supabase as publicSupabase } from '#lib/supabase.ts';
import { logActivity, type ActivityCategory } from '#lib/server/activityLog.ts';
import {
    generateCvPdfBuffer,
    type AuthorCvData,
    type ExperienceData,
    type EducationData,
    type ProjectData,
    type SkillCategoryData
} from '#lib/server/pdfGenerator.ts';
import { loadCvFonts } from '#lib/server/cvFonts.ts';
import { readAvatarBytes } from '#lib/server/profileAssets.ts';
import { fetchProjects, extractGitHubUsername } from '#lib/server/githubProjects.ts';
import { fetchSocials, fetchProjectRepoRules, fetchActiveOpenPgpKey } from '#lib/author.ts';
import {
    cvSnapshot,
    cvVersionBump,
    type CvSnapshot,
    formatCvVersion,
    nextCvVersion,
    parseCvVersion
} from '#lib/cvVersion.ts';
import {
    CV_CHECKSUM_EXTENSIONS,
    CV_SIDECAR_EXTENSIONS,
    CV_SIGNATURE_EXTENSIONS,
    CV_SIGNATURE_LIMIT,
    cvBundleKey,
    cvChecksums,
    cvKey
} from '#lib/server/cvChecksums.ts';
import { buildCvBundle } from '#lib/server/cvBundle.ts';
import { cvBundleFilename } from '#lib/cvVerification.ts';
import { safeKeyserverUrl } from '#lib/openpgpKey.ts';
import {
    OPENPGP_KEY_LIMIT,
    OpenPgpError,
    parseDetachedSignature,
    readLimited,
    parsePublicKey,
    verifyDetachedSignature,
    verifyKeyserver
} from '#lib/server/openpgp.ts';

const CV_PROJECT_LIMIT = 4;

function getAdminDb(platform?: unknown) {
    return getSupabaseAdminClient(platform) || publicSupabase;
}

function getR2Credentials(platform?: any) {
    const accountId =
        platform?.env?.R2_ACCOUNT_ID ?? privateEnv.R2_ACCOUNT_ID ?? process.env.R2_ACCOUNT_ID;
    const accessKeyId =
        platform?.env?.R2_ACCESS_KEY_ID
        ?? privateEnv.R2_ACCESS_KEY_ID
        ?? process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey =
        platform?.env?.R2_SECRET_ACCESS_KEY
        ?? privateEnv.R2_SECRET_ACCESS_KEY
        ?? process.env.R2_SECRET_ACCESS_KEY;
    const bucketName =
        platform?.env?.R2_BUCKET_NAME ?? privateEnv.R2_BUCKET_NAME ?? process.env.R2_BUCKET_NAME;
    const rawCdnUrl =
        platform?.env?.PUBLIC_CDN_BASE_URL
        || publicEnv.PUBLIC_CDN_BASE_URL
        || process.env.PUBLIC_CDN_BASE_URL
        || '';
    const cdnUrl = rawCdnUrl.trim().replace(/\/+$/, '');

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !cdnUrl) {
        return null;
    }

    return { accountId, accessKeyId, secretAccessKey, bucketName, cdnUrl };
}

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

function fail(message: string, status = 500) {
    return jsonResponse({ success: false, message }, status);
}

function decodeHtmlEntities(str: string): string {
    if (!str) return '';
    return str
        .replace(/&#x2F;/gi, '/')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

function safeClientAddress(getClientAddress?: () => string): string | null {
    if (!getClientAddress) return null;
    try {
        return getClientAddress();
    } catch {
        return null;
    }
}

function ipSaltFromPlatform(platform?: unknown): string {
    return (
        (platform as { env?: { IP_SALT?: string } } | undefined)?.env?.IP_SALT
        ?? privateEnv.IP_SALT
        ?? ''
    );
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

async function logCvActivity(
    req: Request,
    platform: unknown,
    db: ReturnType<typeof getAdminDb>,
    action: string,
    entityId: string,
    summary: string,
    getClientAddress?: () => string
) {
    await logActivity(
        {
            actor: await resolveActor(req, db),
            action,
            category: 'cv' as ActivityCategory,
            entityId,
            summary,
            ip: safeClientAddress(getClientAddress),
            ipSalt: ipSaltFromPlatform(platform),
            userAgent: req.headers.get('user-agent') ?? undefined
        },
        db
    );
}

export async function requireAdminAuth(req: Request, platform?: unknown): Promise<Response | null> {
    const auth = await verifyAdminToken(req, getAdminDb(platform));
    if (auth.status)
        return jsonResponse(
            { success: false, code: auth.status, message: auth.message },
            auth.status
        );
    return null;
}

export function formatAuthorSlug(name?: string): string {
    if (!name || !name.trim()) return 'CV-Profile';
    const cleanName = decodeHtmlEntities(name);
    const words = cleanName
        .trim()
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

    const slug = words.join('_') || 'Profile';
    return `CV-${slug}`;
}

function r2Client(creds: NonNullable<ReturnType<typeof getR2Credentials>>) {
    return new S3Client({
        region: 'auto',
        endpoint: `https://${creds.accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey }
    });
}

function cvObjectKeys(filename: string) {
    return [
        cvKey(filename),
        ...CV_SIDECAR_EXTENSIONS.map(ext => cvKey(filename, ext)),
        cvBundleKey(filename),
        filename,
        `${filename}.sha256`
    ];
}

async function putCvObject(
    platform: unknown,
    db: ReturnType<typeof getAdminDb>,
    key: string,
    body: Uint8Array,
    contentType: string,
    downloadName?: string
) {
    const creds = getR2Credentials(platform);
    if (creds) {
        await r2Client(creds).send(
            new PutObjectCommand({
                Bucket: creds.bucketName,
                Key: key,
                Body: body,
                ContentType: contentType,
                CacheControl: 'public, max-age=60',
                ...(downloadName ?
                    { ContentDisposition: `attachment; filename="${downloadName}"` }
                :   {})
            })
        );
        return;
    }
    const { error } = await db.storage
        .from('cv_documents')
        .upload(key, body, { contentType, upsert: true, cacheControl: '60' });
    if (error) throw error;
}

async function deleteCvObjects(
    platform: unknown,
    db: ReturnType<typeof getAdminDb>,
    keys: string[]
) {
    const creds = getR2Credentials(platform);
    if (creds)
        await r2Client(creds).send(
            new DeleteObjectsCommand({
                Bucket: creds.bucketName,
                Delete: { Objects: keys.map(Key => ({ Key })) }
            })
        );
    else await db.storage.from('cv_documents').remove(keys);
}

interface ActiveCvDocument {
    id: string;
    filename: string;
    file_url: string;
    signed_at: string | null;
}

async function activeCvDocument(db: ReturnType<typeof getAdminDb>) {
    const { data, error } = await db
        .from('db_documents')
        .select('id, filename, file_url, signed_at')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return (data?.filename && data.file_url ? data : null) as ActiveCvDocument | null;
}

async function fetchBytes(url: string) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`CV storage returned ${response.status} for ${url}`);
    return new Uint8Array(await response.arrayBuffer());
}

async function storedSignature(fileUrl: string) {
    for (const ext of CV_SIGNATURE_EXTENSIONS) {
        try {
            const parsed = await parseDetachedSignature(await fetchBytes(`${fileUrl}.${ext}`));
            return { asc: parsed.asc, sig: parsed.sig };
        } catch {
            continue;
        }
    }
    return null;
}

async function siteUrlFor(db: ReturnType<typeof getAdminDb>, platform: unknown) {
    const { data } = await db.from('db_profiles').select('site_url').limit(1).maybeSingle();
    return (
        data?.site_url
        || (platform as { env?: { PUBLIC_SITE_URL?: string } } | undefined)?.env?.PUBLIC_SITE_URL
        || (publicEnv as Record<string, string | undefined>).PUBLIC_SITE_URL
        || ''
    ).replace(/\/+$/, '');
}

async function storeCvSignature(
    platform: unknown,
    db: ReturnType<typeof getAdminDb>,
    filename: string,
    signature: { asc: string; sig: Uint8Array }
) {
    await putCvObject(
        platform,
        db,
        cvKey(filename, 'asc'),
        new TextEncoder().encode(signature.asc),
        'application/pgp-signature',
        `${filename}.asc`
    );
    await putCvObject(
        platform,
        db,
        cvKey(filename, 'sig'),
        signature.sig,
        'application/pgp-signature',
        `${filename}.sig`
    );
}

async function clearCvSignature(
    platform: unknown,
    db: ReturnType<typeof getAdminDb>,
    doc: ActiveCvDocument
) {
    await deleteCvObjects(
        platform,
        db,
        CV_SIGNATURE_EXTENSIONS.map(ext => cvKey(doc.filename, ext))
    );
    await db
        .from('db_documents')
        .update({ signed_at: null, signer_fingerprint: null })
        .eq('id', doc.id);
}

async function refreshCvBundle(
    platform: unknown,
    db: ReturnType<typeof getAdminDb>,
    doc: ActiveCvDocument,
    known: { pdf?: Uint8Array; signature?: { asc: string; sig: Uint8Array } | null } = {}
) {
    const pdf = known.pdf ?? (await fetchBytes(doc.file_url));
    const { digests, files } = await cvChecksums(pdf, doc.filename);
    const signature =
        known.signature !== undefined ? known.signature
        : doc.signed_at ? await storedSignature(doc.file_url)
        : null;
    if (signature && known.signature === undefined)
        await storeCvSignature(platform, db, doc.filename, signature);
    const key = await fetchActiveOpenPgpKey(db, { strict: true });
    const bundle = buildCvBundle({
        filename: doc.filename,
        pdf,
        checksumFiles: files,
        signature,
        publicKey: key?.armored ?? null,
        key,
        siteUrl: await siteUrlFor(db, platform),
        apiBase:
            (platform as { env?: { PUBLIC_API_BASE_URL?: string } } | undefined)?.env
                ?.PUBLIC_API_BASE_URL || publicEnv.PUBLIC_API_BASE_URL,
        date: new Date()
    });
    await putCvObject(
        platform,
        db,
        cvBundleKey(doc.filename),
        bundle,
        'application/zip',
        cvBundleFilename(doc.filename)
    );
    await db.from('db_documents').update({ checksums: digests }).eq('id', doc.id);
}

async function removeCvObjects(
    platform: unknown,
    db: ReturnType<typeof getAdminDb>,
    filename: string,
    strict: boolean
) {
    const keys = cvObjectKeys(filename);
    const creds = getR2Credentials(platform);
    if (strict && !creds) return false;
    if (creds) {
        try {
            await r2Client(creds).send(
                new DeleteObjectsCommand({
                    Bucket: creds.bucketName,
                    Delete: { Objects: keys.map(Key => ({ Key })) }
                })
            );
        } catch (err) {
            console.error('R2 deletion warning:', err);
            if (strict) return false;
        }
    }
    try {
        const { error } = await db.storage.from('cv_documents').remove(keys);
        if (strict && error) return false;
    } catch (err) {
        console.error('Supabase storage removal warning:', err);
        if (strict) return false;
    }
    return true;
}

export async function deleteCvFile(
    platform: unknown,
    db: ReturnType<typeof getAdminDb>,
    filename: string,
    strict = false
): Promise<boolean> {
    if (!(await removeCvObjects(platform, db, filename, strict))) return false;
    const { error: deleteError } = await db.from('db_documents').delete().eq('filename', filename);
    return !deleteError;
}

export async function processCvGenerate(
    req: Request,
    platform?: unknown,
    getClientAddress?: () => string
): Promise<Response> {
    try {
        const authError = await requireAdminAuth(req, platform);
        if (authError) return authError;

        const db = getAdminDb(platform);

        let force = false;
        try {
            const body = await req.json();
            force = body?.force === true;
        } catch {
            force = false;
        }

        const { data: profile } = await db.from('db_profiles').select('*').limit(1).maybeSingle();

        if (!profile?.id) {
            return jsonResponse(
                { success: false, code: 404, message: 'Author profile not found in database.' },
                404
            );
        }

        const [
            { data: experiences, error: experiencesError },
            { data: educations, error: educationsError },
            { data: categories, error: categoriesError },
            socials,
            repoRules
        ] = await Promise.all([
            db
                .from('db_experiences')
                .select(
                    'title, company, type, location, loc_type, start_date, end_date, currently_in, description'
                )
                .order('sort_order', { ascending: true }),
            db
                .from('db_educations')
                .select(
                    'institution, degree, field, grade, start_date, end_date, currently_in, description'
                )
                .order('sort_order', { ascending: true }),
            db
                .from('db_categories')
                .select('id, category, sort_order, db_items(id, name, sort_order)')
                .order('sort_order', { ascending: true }),
            fetchSocials(db),
            fetchProjectRepoRules(db)
        ]);

        const loadError = experiencesError || educationsError || categoriesError;
        if (loadError) {
            console.error('CV data query failed:', loadError);
            return fail('Failed to load CV data.');
        }

        const skillCategories: SkillCategoryData[] = (categories || []).map((cat: any) => ({
            category: cat.category,
            items: (cat.db_items || [])
                .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map((item: any) => item.name)
        }));

        const githubUsername = extractGitHubUsername({ ...profile, socialLinks: socials });
        const repositories =
            githubUsername ?
                await fetchProjects(githubUsername, fetch, platform, repoRules.excluded)
            :   [];
        const pinned = new Set(repoRules.pinned.map(name => name.toLowerCase()));
        const projects: ProjectData[] = [...repositories]
            .sort(
                (a, b) =>
                    Number(pinned.has(b.name.toLowerCase()))
                        - Number(pinned.has(a.name.toLowerCase()))
                    || b.stars - a.stars
                    || (b.pushedAt ?? '').localeCompare(a.pushedAt ?? '')
            )
            .slice(0, CV_PROJECT_LIMIT)
            .map(repo => ({ name: repo.name, url: repo.url, desc: repo.desc, lang: repo.lang }));

        const cvData: AuthorCvData = {
            profile: {
                name: profile.name || '',
                title: profile.job_title || profile.headline || '',
                bio: profile.bio || '',
                email: profile.email || '',
                website: profile.site_url || '',
                location: [profile.city, profile.country].filter(Boolean).join(', '),
                avatarBytes: await readAvatarBytes(
                    platform as Pick<App.Platform, 'env'> | undefined,
                    profile.avatar_version
                )
            },
            links: socials
                .filter(item => /github|linkedin/i.test(item.platform))
                .map(item => ({ url: item.url })),
            experiences: (experiences || []) as ExperienceData[],
            projects,
            educations: (educations || []) as EducationData[],
            skills: skillCategories
        };

        const snapshot = cvSnapshot({
            profile: { ...cvData.profile },
            avatar: profile.avatar_version ?? null,
            links: cvData.links.map(link => link.url),
            experiences: experiences || [],
            educations: educations || [],
            skills: skillCategories,
            projects
        });

        const { data: activeDoc } = await db
            .from('db_documents')
            .select('id, filename')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();
        const { data: previousSnapshot } =
            activeDoc ?
                await db
                    .from('db_document_snapshots')
                    .select('content')
                    .eq('document_id', activeDoc.id)
                    .maybeSingle()
            :   { data: null };

        let bump =
            activeDoc ?
                cvVersionBump(
                    (previousSnapshot?.content as CvSnapshot | undefined) ?? null,
                    snapshot
                )
            :   null;
        if (activeDoc && !bump && !force)
            return jsonResponse({
                success: true,
                upToDate: true,
                filename: activeDoc.filename,
                version: formatCvVersion(
                    parseCvVersion(activeDoc.filename) ?? { major: 1, minor: 0 }
                )
            });
        if (activeDoc && !bump) bump = { level: 'minor', reasons: ['Regenerated on request'] };
        const version =
            activeDoc ?
                nextCvVersion(parseCvVersion(activeDoc.filename), bump!.level)
            :   { major: 1, minor: 0 };
        const reasons = activeDoc ? bump!.reasons : ['First version'];
        const versionLabel = formatCvVersion(version);

        const r2Creds = getR2Credentials(platform);
        const pdfBytes = await generateCvPdfBuffer(cvData, loadCvFonts());
        const shortHash = Array.from(
            new Uint8Array(
                await crypto.subtle.digest('SHA-256', new Uint8Array(pdfBytes))
            ).subarray(0, 4),
            byte => byte.toString(16).padStart(2, '0')
        )
            .join('')
            .slice(0, 7);
        const filename = `${formatAuthorSlug(profile.name)}-${shortHash}-v${versionLabel}.pdf`;
        const { digests, files: checksumFiles } = await cvChecksums(pdfBytes, filename);

        const { data: previousDocs } = await db
            .from('db_documents')
            .select('id, filename')
            .eq('is_active', true);
        for (const oldDoc of previousDocs ?? [])
            if (oldDoc.filename && oldDoc.filename !== filename)
                await removeCvObjects(platform, db, oldDoc.filename, false);

        let fileUrl = '';
        let storageProvider: 'R2' | 'Supabase Storage' = 'R2';
        const uploads: [string, Uint8Array, string][] = [
            [cvKey(filename), pdfBytes, 'application/pdf'],
            ...CV_CHECKSUM_EXTENSIONS.map(
                ext =>
                    [
                        cvKey(filename, ext),
                        new TextEncoder().encode(checksumFiles[ext]),
                        'text/plain; charset=utf-8'
                    ] as [string, Uint8Array, string]
            )
        ];

        if (r2Creds) {
            try {
                const client = r2Client(r2Creds);
                for (const [Key, Body, ContentType] of uploads)
                    await client.send(
                        new PutObjectCommand({
                            Bucket: r2Creds.bucketName,
                            Key,
                            Body,
                            ContentType,
                            CacheControl: 'public, max-age=300'
                        })
                    );
                fileUrl = `${r2Creds.cdnUrl}/${cvKey(filename)}`;
            } catch (r2Err) {
                console.error('R2 upload failed, trying Supabase Storage fallback:', r2Err);
            }
        }

        if (!fileUrl) {
            storageProvider = 'Supabase Storage';
            const bucket = db.storage.from('cv_documents');
            for (const [key, body, contentType] of uploads) {
                const { error: storageError } = await bucket.upload(key, body, {
                    contentType,
                    upsert: true
                });
                if (storageError) return fail('Failed to upload CV file.');
            }
            fileUrl = bucket.getPublicUrl(cvKey(filename)).data.publicUrl;
        }

        await db.from('db_documents').update({ is_active: false }).eq('is_active', true);

        const { data: inserted, error: insertError } = await db
            .from('db_documents')
            .insert({
                author_id: profile.id,
                filename,
                file_url: fileUrl,
                hash: digests.sha256,
                checksums: digests,
                version: versionLabel,
                is_active: true
            })
            .select('id')
            .single();

        if (insertError || !inserted) {
            return fail('Failed to save CV record.');
        }

        const { error: snapshotError } = await db
            .from('db_document_snapshots')
            .insert({ document_id: inserted.id, content: snapshot });
        if (snapshotError) console.error('CV snapshot could not be saved:', snapshotError);

        try {
            await refreshCvBundle(
                platform,
                db,
                { id: inserted.id, filename, file_url: fileUrl, signed_at: null },
                { pdf: pdfBytes, signature: null }
            );
        } catch (bundleError) {
            console.error('CV verification bundle could not be built:', bundleError);
        }

        await logCvActivity(
            req,
            platform,
            db,
            'cv.upload',
            filename,
            `Generated CV document v${versionLabel} (${reasons.join(', ')}).`,
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
                reasons,
                storageProvider
            },
            200
        );
    } catch (err: any) {
        console.error('Unhandled processCvGenerate error:', err);
        return fail('Failed to auto-generate CV document.');
    }
}

export async function processCvUpload(
    req: Request,
    platform?: unknown,
    getClientAddress?: () => string
): Promise<Response> {
    return processCvGenerate(req, platform, getClientAddress);
}

export async function processCvDelete(
    req: Request,
    platform?: unknown,
    getClientAddress?: () => string
): Promise<Response> {
    try {
        const authError = await requireAdminAuth(req, platform);
        if (authError) return authError;

        const db = getAdminDb(platform);
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
            const { data: doc, error: lookupError } = await db
                .from('db_documents')
                .select('filename')
                .eq('filename', targetFilename)
                .limit(1)
                .maybeSingle();

            if (lookupError || !doc?.filename) {
                return jsonResponse({ success: false, message: 'CV document not found.' }, 404);
            }
            filename = doc.filename;
        } else {
            const { data: activeDoc, error: lookupError } = await db
                .from('db_documents')
                .select('filename')
                .eq('is_active', true)
                .limit(1)
                .maybeSingle();

            if (lookupError || !activeDoc?.filename) {
                return jsonResponse(
                    { success: false, message: 'No active CV document to delete.' },
                    404
                );
            }
            filename = activeDoc.filename;
        }

        const deleted = await deleteCvFile(platform, db, filename);
        if (!deleted) {
            return fail('Failed to remove CV record.');
        }

        await logCvActivity(
            req,
            platform,
            db,
            'cv.delete',
            filename,
            'Deleted CV document.',
            getClientAddress
        );

        return jsonResponse({ success: true, filename }, 200);
    } catch (err: any) {
        console.error('Unhandled processCvDelete error:', err);
        return fail('Failed to delete CV document.');
    }
}

function openPgpFailure(err: unknown, fallback: string) {
    if (err instanceof OpenPgpError)
        return jsonResponse({ success: false, message: err.message }, 422);
    console.error(fallback, err);
    return fail(fallback);
}

export async function processCvSignature(
    req: Request,
    platform?: unknown,
    getClientAddress?: () => string
): Promise<Response> {
    try {
        const authError = await requireAdminAuth(req, platform);
        if (authError) return authError;
        const db = getAdminDb(platform);
        const doc = await activeCvDocument(db);
        if (!doc) return jsonResponse({ success: false, message: 'No active CV document.' }, 404);

        if (req.method === 'DELETE') {
            await clearCvSignature(platform, db, doc);
            await refreshCvBundle(platform, db, { ...doc, signed_at: null }, { signature: null });
            await logCvActivity(
                req,
                platform,
                db,
                'cv.signature_delete',
                doc.filename,
                'Removed the CV signature.',
                getClientAddress
            );
            return jsonResponse({ success: true, signedAt: null, signerFingerprint: null });
        }

        if (Number(req.headers.get('content-length')) > CV_SIGNATURE_LIMIT)
            return jsonResponse(
                { success: false, message: 'Signature files are at most 16 KiB.' },
                413
            );
        let upload: Uint8Array;
        try {
            upload = await readLimited(req.body, CV_SIGNATURE_LIMIT);
        } catch {
            return jsonResponse(
                { success: false, message: 'Signature files are at most 16 KiB.' },
                413
            );
        }
        const activeKey = await fetchActiveOpenPgpKey(db, { strict: true });
        if (!activeKey)
            return jsonResponse(
                {
                    success: false,
                    message: 'Add your OpenPGP public key before uploading a signature.'
                },
                409
            );
        const { key } = await parsePublicKey(new TextEncoder().encode(activeKey.armored));
        const signature = await parseDetachedSignature(upload);
        const pdf = await fetchBytes(doc.file_url);
        await verifyDetachedSignature(pdf, signature.signature, key);

        const files = { asc: signature.asc, sig: signature.sig };
        await storeCvSignature(platform, db, doc.filename, files);
        const signedAt = new Date().toISOString();
        await db
            .from('db_documents')
            .update({ signed_at: signedAt, signer_fingerprint: activeKey.fingerprint })
            .eq('id', doc.id);
        await refreshCvBundle(
            platform,
            db,
            { ...doc, signed_at: signedAt },
            { pdf, signature: files }
        );
        await logCvActivity(
            req,
            platform,
            db,
            'cv.signature_upload',
            doc.filename,
            `Uploaded a verified CV signature from ${activeKey.fingerprint}.`,
            getClientAddress
        );
        return jsonResponse({ success: true, signedAt, signerFingerprint: activeKey.fingerprint });
    } catch (err) {
        return openPgpFailure(err, 'Failed to update the CV signature.');
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
        const db = getAdminDb(platform);
        const existing = await fetchActiveOpenPgpKey(db, { strict: true });
        const doc = await activeCvDocument(db);

        if (req.method === 'DELETE') {
            const { error } = await db.from('db_openpgp_keys').delete().eq('is_active', true);
            if (error) return fail('Failed to remove the OpenPGP key.');
            if (doc) {
                if (doc.signed_at) await clearCvSignature(platform, db, doc);
                await refreshCvBundle(
                    platform,
                    db,
                    { ...doc, signed_at: null },
                    { signature: null }
                );
            }
            await logCvActivity(
                req,
                platform,
                db,
                'cv.openpgp_key_delete',
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
            return jsonResponse(
                { success: false, message: 'Public keys must be at most 64 KiB.' },
                413
            );
        let body: any;
        try {
            body = JSON.parse(
                new TextDecoder().decode(await readLimited(req.body, OPENPGP_KEY_LIMIT * 2))
            );
        } catch (err) {
            return err instanceof RangeError ?
                    jsonResponse(
                        { success: false, message: 'Public keys must be at most 64 KiB.' },
                        413
                    )
                :   jsonResponse({ success: false, message: 'Invalid request body.' }, 400);
        }
        const upload =
            typeof body?.key?.armored === 'string' ? new TextEncoder().encode(body.key.armored)
            : typeof body?.key?.base64 === 'string' ? base64Bytes(body.key.base64)
            : existing ? new TextEncoder().encode(existing.armored)
            : null;
        if (!upload)
            return jsonResponse(
                { success: false, message: 'Upload your OpenPGP public key.' },
                400
            );
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
        if (failures.length)
            return jsonResponse({ success: false, message: failures.join(' ') }, 422);

        const { error: deactivateError } = await db
            .from('db_openpgp_keys')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('is_active', true)
            .neq('fingerprint', parsed.fingerprint);
        if (deactivateError) return fail('Failed to save the OpenPGP key.');
        const { error: saveError } = await db
            .from('db_openpgp_keys')
            .upsert(
                {
                    fingerprint: parsed.fingerprint,
                    armored: parsed.armored,
                    user_ids: parsed.userIds,
                    algorithm: parsed.algorithm,
                    key_created_at: parsed.createdAt,
                    expires_at: parsed.expiresAt,
                    keyservers,
                    is_active: true,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'fingerprint' }
            );
        if (saveError) return fail('Failed to save the OpenPGP key.');

        const { data: signer } =
            doc ?
                await db
                    .from('db_documents')
                    .select('signer_fingerprint')
                    .eq('id', doc.id)
                    .maybeSingle()
            :   { data: null };
        const signatureCleared = Boolean(
            doc?.signed_at && signer?.signer_fingerprint !== parsed.fingerprint
        );
        if (doc) {
            if (signatureCleared) await clearCvSignature(platform, db, doc);
            await refreshCvBundle(
                platform,
                db,
                { ...doc, signed_at: signatureCleared ? null : doc.signed_at },
                signatureCleared ? { signature: null } : {}
            );
        }
        await logCvActivity(
            req,
            platform,
            db,
            'cv.openpgp_key',
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
