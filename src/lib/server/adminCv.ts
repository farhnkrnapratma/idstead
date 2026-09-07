import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import {env as privateEnv} from '$env/dynamic/private';
import {env as publicEnv} from '$env/dynamic/public';
import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {supabase as publicSupabase} from '$lib/supabase';
import {
  generateCvPdfBuffer,
  type AuthorCvData,
  type ExperienceData,
  type EducationData,
  type SkillCategoryData
} from '$lib/server/pdfGenerator';

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

export async function requireAdminAuth(
  req: Request,
  platform?: unknown
): Promise<Response | null> {
  const auth = req.headers.get('authorization');
  if (!auth) {
    return jsonResponse(
      {success: false, code: 401, message: 'Missing Authorization header.'},
      401
    );
  }

  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const db = getAdminDb(platform);

  let user: any;

  try {
    const res = await db.auth.getUser(token);
    user = res.data?.user;
  } catch {
    user = null;
  }

  if (!user?.id && db !== publicSupabase) {
    try {
      const fallbackRes = await publicSupabase.auth.getUser(token);
      if (fallbackRes.data?.user?.id) {
        user = fallbackRes.data.user;
      }
    } catch {
      user = null;
    }
  }

  if (!user?.id) {
    return jsonResponse(
      {success: false, code: 401, message: 'Invalid or expired admin token.'},
      401
    );
  }

  const role = (user.app_metadata as {role?: string} | null)?.role;
  if (role !== 'admin' && role !== 'service_role') {
    return jsonResponse(
      {success: false, code: 403, message: 'Admin privileges required.'},
      403
    );
  }

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

export async function processCvGenerate(
  req: Request,
  platform?: unknown
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

    const {data: experiences} = await db
      .from('db_experiences')
      .select(
        'role, company, location, start_date, end_date, is_current, description'
      )
      .order('sort_order', {ascending: true});

    const {data: educations} = await db
      .from('db_educations')
      .select(
        'institution, degree, field_of_study, start_date, end_date, description'
      )
      .order('sort_order', {ascending: true});

    const {data: categories} = await db
      .from('db_categories')
      .select('id, category, sort_order, db_items(id, name, sort_order)')
      .order('sort_order', {ascending: true});

    const skillCategories: SkillCategoryData[] = (categories || []).map(
      (cat: any) => ({
        category: decodeHtmlEntities(cat.category),
        items: (cat.db_items || [])
          .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((item: any) => decodeHtmlEntities(item.name))
      })
    );

    const locationStr = [profile.city, profile.country]
      .filter(Boolean)
      .map(decodeHtmlEntities)
      .join(', ');

    const cvData: AuthorCvData = {
      profile: {
        name: decodeHtmlEntities(profile.name || ''),
        title: decodeHtmlEntities(profile.job_title || profile.headline || ''),
        bio: decodeHtmlEntities(profile.bio || ''),
        avatar: profile.avatar || '',
        email: profile.email || '',
        website: profile.site_url || '',
        location: locationStr
      },
      experiences: ((experiences || []) as ExperienceData[]).map(e => ({
        ...e,
        role: decodeHtmlEntities(e.role),
        company: decodeHtmlEntities(e.company),
        location: decodeHtmlEntities(e.location || ''),
        description: decodeHtmlEntities(e.description || '')
      })),
      educations: ((educations || []) as EducationData[]).map(ed => ({
        ...ed,
        institution: decodeHtmlEntities(ed.institution),
        degree: decodeHtmlEntities(ed.degree || ''),
        field_of_study: decodeHtmlEntities(ed.field_of_study || ''),
        description: decodeHtmlEntities(ed.description || '')
      })),
      skills: skillCategories
    };

    const r2Creds = getR2Credentials(platform);
    const pdfBytes = await generateCvPdfBuffer(cvData, r2Creds?.cdnUrl);

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
  platform?: unknown
): Promise<Response> {
  return processCvGenerate(req, platform);
}

export async function processCvDelete(
  req: Request,
  platform?: unknown
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

    const sha256Filename = `${filename}.sha256`;
    const r2Creds = getR2Credentials(platform);

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
      }
    }

    try {
      await db.storage.from('cv_documents').remove([filename, sha256Filename]);
    } catch (err) {
      console.error('Supabase storage removal warning:', err);
    }

    const {error: deleteError} = await db
      .from('db_documents')
      .delete()
      .eq('filename', filename);

    if (deleteError) {
      return fail('Failed to remove CV record.');
    }

    return jsonResponse({success: true, filename}, 200);
  } catch (err: any) {
    console.error('Unhandled processCvDelete error:', err);
    return fail('Failed to delete CV document.');
  }
}
