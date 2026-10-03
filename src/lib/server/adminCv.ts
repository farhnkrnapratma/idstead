import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import {verifyAdminToken, bearerToken} from './adminAuth';
import {env as privateEnv} from '$env/dynamic/private';
import {env as publicEnv} from '$env/dynamic/public';
import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {supabase as publicSupabase} from '$lib/supabase';
import {logActivity, type ActivityCategory} from '$lib/server/activityLog';
import {
  generateCvPdfBuffer,
  type AuthorCvData,
  type ExperienceData,
  type EducationData,
  type ProjectData,
  type SkillCategoryData
} from '$lib/server/pdfGenerator';
import {loadCvFonts} from '$lib/server/cvFonts';
import {readAvatarBytes} from '$lib/server/profileAssets';
import {fetchProjects, extractGitHubUsername} from '$lib/server/githubProjects';
import {fetchSocials, fetchProjectRepoRules} from '$lib/author';

const CV_PROJECT_LIMIT = 4;

function getAdminDb(platform?: unknown) {
  return getSupabaseAdminClient(platform) || publicSupabase;
}

function getR2Credentials(platform?: any) {
  const accountId =
    platform?.env?.R2_ACCOUNT_ID
    ?? privateEnv.R2_ACCOUNT_ID
    ?? process.env.R2_ACCOUNT_ID;
  const accessKeyId =
    platform?.env?.R2_ACCESS_KEY_ID
    ?? privateEnv.R2_ACCESS_KEY_ID
    ?? process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey =
    platform?.env?.R2_SECRET_ACCESS_KEY
    ?? privateEnv.R2_SECRET_ACCESS_KEY
    ?? process.env.R2_SECRET_ACCESS_KEY;
  const bucketName =
    platform?.env?.R2_BUCKET_NAME
    ?? privateEnv.R2_BUCKET_NAME
    ?? process.env.R2_BUCKET_NAME;
  const rawCdnUrl =
    platform?.env?.PUBLIC_CDN_BASE_URL
    || publicEnv.PUBLIC_CDN_BASE_URL
    || process.env.PUBLIC_CDN_BASE_URL
    || '';
  const cdnUrl = rawCdnUrl.trim().replace(/\/+$/, '');

  if (
    !accountId
    || !accessKeyId
    || !secretAccessKey
    || !bucketName
    || !cdnUrl
  ) {
    return null;
  }

  return {accountId, accessKeyId, secretAccessKey, bucketName, cdnUrl};
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json; charset=utf-8'}
  });
}

function fail(message: string, status = 500) {
  return jsonResponse({success: false, message}, status);
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
    (platform as {env?: {IP_SALT?: string}} | undefined)?.env?.IP_SALT
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
  const {data} = await db.auth.getUser(token);
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

export async function requireAdminAuth(
  req: Request,
  platform?: unknown
): Promise<Response | null> {
  const auth = await verifyAdminToken(req, getAdminDb(platform));
  if (auth.status)
    return jsonResponse(
      {success: false, code: auth.status, message: auth.message},
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

function parseSemver(filename?: string): {
  major: number;
  minor: number;
  patch: number;
} {
  if (!filename) return {major: 1, minor: 0, patch: 0};
  const match = filename.match(/-v(\d+)\.(\d+)\.(\d+)\.pdf$/i);
  if (match) {
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10)
    };
  }
  return {major: 1, minor: 0, patch: 0};
}

function bumpSemver(
  current: {major: number; minor: number; patch: number},
  bumpType: 'patch' | 'minor' | 'major' = 'patch'
): string {
  if (bumpType === 'major') {
    return `${current.major + 1}.0.0`;
  } else if (bumpType === 'minor') {
    return `${current.major}.${current.minor + 1}.0`;
  } else {
    return `${current.major}.${current.minor}.${current.patch + 1}`;
  }
}

export async function deleteCvFile(
  platform: unknown,
  db: ReturnType<typeof getAdminDb>,
  filename: string,
  strict = false
): Promise<boolean> {
  const sha256Filename = `${filename}.sha256`;
  const r2Creds = getR2Credentials(platform);
  if (strict && !r2Creds) return false;

  if (r2Creds) {
    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${r2Creds.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2Creds.accessKeyId,
        secretAccessKey: r2Creds.secretAccessKey
      }
    });
    try {
      await r2Client.send(
        new DeleteObjectCommand({Bucket: r2Creds.bucketName, Key: filename})
      );
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: r2Creds.bucketName,
          Key: sha256Filename
        })
      );
    } catch (err) {
      console.error('R2 deletion warning:', err);
      if (strict) return false;
    }
  }

  try {
    const {error} = await db.storage
      .from('cv_documents')
      .remove([filename, sha256Filename]);
    if (strict && error) return false;
  } catch (err) {
    console.error('Supabase storage removal warning:', err);
    if (strict) return false;
  }

  const {error: deleteError} = await db
    .from('db_documents')
    .delete()
    .eq('filename', filename);

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

    let bumpType: 'patch' | 'minor' | 'major' = 'patch';
    try {
      const body = await req.json();
      if (
        body?.bumpType === 'major'
        || body?.bumpType === 'minor'
        || body?.bumpType === 'patch'
      ) {
        bumpType = body.bumpType;
      }
    } catch {
      bumpType = 'patch';
    }

    const {data: profile} = await db
      .from('db_profiles')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!profile?.id) {
      return jsonResponse(
        {
          success: false,
          code: 404,
          message: 'Author profile not found in database.'
        },
        404
      );
    }

    const [
      {data: experiences, error: experiencesError},
      {data: educations, error: educationsError},
      {data: categories, error: categoriesError},
      socials,
      repoRules
    ] = await Promise.all([
      db
        .from('db_experiences')
        .select(
          'title, company, type, location, loc_type, start_date, end_date, currently_in, description'
        )
        .order('sort_order', {ascending: true}),
      db
        .from('db_educations')
        .select(
          'institution, degree, field, grade, start_date, end_date, currently_in, description'
        )
        .order('sort_order', {ascending: true}),
      db
        .from('db_categories')
        .select('id, category, sort_order, db_items(id, name, sort_order)')
        .order('sort_order', {ascending: true}),
      fetchSocials(db),
      fetchProjectRepoRules(db)
    ]);

    const loadError = experiencesError || educationsError || categoriesError;
    if (loadError) {
      console.error('CV data query failed:', loadError);
      return fail('Failed to load CV data.');
    }

    const skillCategories: SkillCategoryData[] = (categories || []).map(
      (cat: any) => ({
        category: cat.category,
        items: (cat.db_items || [])
          .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((item: any) => item.name)
      })
    );

    const githubUsername = extractGitHubUsername({
      ...profile,
      socialLinks: socials
    });
    const repositories =
      githubUsername ?
        await fetchProjects(githubUsername, fetch, platform, repoRules.excluded)
      : [];
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
      .map(repo => ({
        name: repo.name,
        url: repo.url,
        desc: repo.desc,
        lang: repo.lang
      }));

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
        .map(item => ({url: item.url})),
      experiences: (experiences || []) as ExperienceData[],
      projects,
      educations: (educations || []) as EducationData[],
      skills: skillCategories
    };

    const r2Creds = getR2Credentials(platform);
    const pdfBytes = await generateCvPdfBuffer(cvData, loadCvFonts());

    const digestBuffer = await crypto.subtle.digest(
      'SHA-256',
      pdfBytes.buffer as ArrayBuffer
    );
    const fullHash = Array.from(new Uint8Array(digestBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const shortHash = fullHash.slice(0, 7);

    const {data: activeDoc} = await db
      .from('db_documents')
      .select('filename')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    let nextVersion = '1.0.0';
    if (activeDoc?.filename) {
      const currentVersionObj = parseSemver(activeDoc.filename);
      nextVersion = bumpSemver(currentVersionObj, bumpType);
    }

    const authorSlug = formatAuthorSlug(profile.name);
    const filename = `${authorSlug}-${shortHash}-v${nextVersion}.pdf`;
    const sha256Filename = `${filename}.sha256`;
    const sha256Content = `${fullHash}  ${filename}\n`;
    const sha256Bytes = new TextEncoder().encode(sha256Content);

    let r2Client: S3Client | null = null;
    if (r2Creds) {
      r2Client = new S3Client({
        region: 'auto',
        endpoint: `https://${r2Creds.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: r2Creds.accessKeyId,
          secretAccessKey: r2Creds.secretAccessKey
        }
      });
    }

    const {data: previousDocs} = await db
      .from('db_documents')
      .select('id, filename')
      .eq('is_active', true);

    if (previousDocs && previousDocs.length > 0) {
      for (const oldDoc of previousDocs) {
        if (oldDoc.filename) {
          const oldPdfKey = oldDoc.filename;
          const oldShaKey = `${oldDoc.filename}.sha256`;
          if (r2Client && r2Creds) {
            try {
              await r2Client.send(
                new DeleteObjectCommand({
                  Bucket: r2Creds.bucketName,
                  Key: oldPdfKey
                })
              );
              await r2Client.send(
                new DeleteObjectCommand({
                  Bucket: r2Creds.bucketName,
                  Key: oldShaKey
                })
              );
            } catch (delErr) {
              console.error('R2 deletion warning for old CV file:', delErr);
            }
          }
          try {
            await db.storage
              .from('cv_documents')
              .remove([oldPdfKey, oldShaKey]);
          } catch (delStorageErr) {
            console.error('Supabase storage removal warning:', delStorageErr);
          }
        }
      }
    }

    let fileUrl = '';
    let storageProvider: 'R2' | 'Supabase Storage' = 'R2';

    if (r2Client && r2Creds) {
      try {
        await r2Client.send(
          new PutObjectCommand({
            Bucket: r2Creds.bucketName,
            Key: filename,
            Body: pdfBytes,
            ContentType: 'application/pdf'
          })
        );
        await r2Client.send(
          new PutObjectCommand({
            Bucket: r2Creds.bucketName,
            Key: sha256Filename,
            Body: sha256Bytes,
            ContentType: 'text/plain; charset=utf-8'
          })
        );
        fileUrl = `${r2Creds.cdnUrl}/${filename}`;
      } catch (r2Err) {
        console.error(
          'R2 upload failed, trying Supabase Storage fallback:',
          r2Err
        );
      }
    }

    if (!fileUrl) {
      storageProvider = 'Supabase Storage';
      const {error: storageError} = await db.storage
        .from('cv_documents')
        .upload(filename, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (storageError) {
        return fail('Failed to upload CV file.');
      }

      await db.storage
        .from('cv_documents')
        .upload(sha256Filename, sha256Bytes, {
          contentType: 'text/plain; charset=utf-8',
          upsert: true
        });

      const {data: publicUrlData} = db.storage
        .from('cv_documents')
        .getPublicUrl(filename);
      fileUrl = publicUrlData.publicUrl;
    }

    await db
      .from('db_documents')
      .update({is_active: false})
      .eq('is_active', true);

    const {error: insertError} = await db
      .from('db_documents')
      .insert({
        author_id: profile.id,
        filename,
        file_url: fileUrl,
        hash: fullHash,
        is_active: true
      });

    if (insertError) {
      return fail('Failed to save CV record.');
    }

    await logCvActivity(
      req,
      platform,
      db,
      'cv.upload',
      filename,
      `Generated CV document v${nextVersion}.`,
      getClientAddress
    );

    return jsonResponse(
      {
        success: true,
        filename,
        fileUrl,
        hash: fullHash,
        version: nextVersion,
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
      const {data: doc, error: lookupError} = await db
        .from('db_documents')
        .select('filename')
        .eq('filename', targetFilename)
        .limit(1)
        .maybeSingle();

      if (lookupError || !doc?.filename) {
        return jsonResponse(
          {success: false, message: 'CV document not found.'},
          404
        );
      }
      filename = doc.filename;
    } else {
      const {data: activeDoc, error: lookupError} = await db
        .from('db_documents')
        .select('filename')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (lookupError || !activeDoc?.filename) {
        return jsonResponse(
          {success: false, message: 'No active CV document to delete.'},
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

    return jsonResponse({success: true, filename}, 200);
  } catch (err: any) {
    console.error('Unhandled processCvDelete error:', err);
    return fail('Failed to delete CV document.');
  }
}
