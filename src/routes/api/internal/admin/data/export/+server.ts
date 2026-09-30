import type {RequestHandler} from './$types';
import {GetObjectCommand} from '@aws-sdk/client-s3';
import {zipSync, type Zippable} from 'fflate';
import {apiError} from '$lib/server/apiError';
import {isSameOriginRequest} from '$lib/server/sameOrigin';
import {getSupabaseAdminClient} from '$lib/server/supabaseAdmin';
import {requireAdminAuth} from '$lib/server/adminCv';
import {assetStorage} from '$lib/server/profileAssets';

function jsonFile(data: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(data, null, 2));
}

export const GET: RequestHandler = async ({request, url, platform}) => {
  if (!isSameOriginRequest(request, url))
    return apiError(403, 'FORBIDDEN', 'Cross-origin requests are forbidden.');
  const authError = await requireAdminAuth(request, platform);
  if (authError) return authError;

  const db = getSupabaseAdminClient(platform);
  if (!db)
    return apiError(
      503,
      'DATA_STORAGE_UNAVAILABLE',
      'Data storage is unavailable.'
    );

  const [
    posts,
    translations,
    glossary,
    projects,
    legals,
    profile,
    experiences,
    educations,
    categories,
    links,
    documents,
    banners,
    activityLog
  ] = await Promise.all([
    db.from('db_posts').select('*'),
    db.from('db_post_translations').select('*'),
    db.from('db_glossary_terms').select('*'),
    db.from('db_project_repo_rules').select('*'),
    db.from('db_legals').select('*'),
    db.from('db_profiles').select('*').limit(1).maybeSingle(),
    db.from('db_experiences').select('*'),
    db.from('db_educations').select('*'),
    db
      .from('db_categories')
      .select('id, category, sort_order, db_items(id, name, sort_order)'),
    db.from('db_links').select('*'),
    db.from('db_documents').select('*'),
    db
      .from('db_blog_banner_versions')
      .select('id, post_id, object_key')
      .eq('state', 'active'),
    db.rpc('db_activity_log_export', {})
  ]);

  const files: Zippable = {
    'posts.json': jsonFile({
      posts: posts.data ?? [],
      translations: translations.data ?? []
    }),
    'glossary.json': jsonFile(glossary.data ?? []),
    'projects.json': jsonFile(projects.data ?? []),
    'legal-pages.json': jsonFile(legals.data ?? []),
    'profile.json': jsonFile({
      profile: profile.data,
      experiences: experiences.data ?? [],
      educations: educations.data ?? [],
      skills: categories.data ?? [],
      links: links.data ?? []
    }),
    'activity-log.json': jsonFile(activityLog.data?.data ?? [])
  };

  // ponytail: only R2-stored files are bundled here — the Supabase Storage
  // fallback path (used when R2 credentials aren't configured) isn't covered.
  try {
    const {client, bucket} = assetStorage(platform);
    for (const doc of documents.data ?? []) {
      try {
        const object = await client.send(
          new GetObjectCommand({Bucket: bucket, Key: doc.filename})
        );
        const bytes = await object.Body?.transformToByteArray();
        if (bytes) files[`files/cv/${doc.filename}`] = new Uint8Array(bytes);
      } catch {}
    }
    for (const banner of banners.data ?? []) {
      try {
        const object = await client.send(
          new GetObjectCommand({Bucket: bucket, Key: banner.object_key})
        );
        const bytes = await object.Body?.transformToByteArray();
        if (bytes)
          files[`files/banners/${banner.object_key}`] = new Uint8Array(bytes);
      } catch {}
    }
  } catch {}

  const zipped = zipSync(files, {level: 6});
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(zipped as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="site-data-${stamp}.zip"`,
      'Cache-Control': 'no-store'
    }
  });
};
