import {createClient} from '@supabase/supabase-js';
import {S3Client, PutObjectCommand, GetObjectCommand} from '@aws-sdk/client-s3';
import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {bannerKey, sha256} from '../src/lib/blogBanner';
import {inspectWebp} from '../src/lib/webp';
import {
  verifyBannerManifest,
  assertMigrationSnapshot,
  migrationCleanupPaths,
  type BannerMigrationManifest
} from '../src/lib/bannerMigration';

const mode = process.argv[2] || 'inventory';
const directory = resolve(process.argv[3] || '.local/blog-banner-migration');
const manifestPath = join(directory, 'manifest.json');
const value = (name: string) => {
  const result = process.env[name];
  if (!result) throw new Error(`Missing configuration: ${name}`);
  return result;
};
const project = value('PUBLIC_SUPABASE_URL')
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/$/, '');
const db = createClient(project, value('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: {persistSession: false, autoRefreshToken: false}
});
await mkdir(directory, {recursive: true});

async function rows(table: string) {
  const result: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const {data, error} = await db
      .from(table)
      .select('*')
      .range(offset, offset + 499);
    if (error) throw new Error(`Cannot inventory ${table}: ${error.message}`);
    result.push(...data);
    if (data.length < 500) return result;
  }
}
async function objects(prefix = ''): Promise<string[]> {
  const result: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const {data, error} = await db.storage
      .from('blog-posts')
      .list(prefix, {
        limit: 100,
        offset,
        sortBy: {column: 'name', order: 'asc'}
      });
    if (error) throw error;
    for (const object of data) {
      const path = prefix ? `${prefix}/${object.name}` : object.name;
      if (object.id) result.push(path);
      else result.push(...(await objects(path)));
    }
    if (data.length < 100) return result;
  }
}
async function download(path: string) {
  const {data, error} = await db.storage.from('blog-posts').download(path);
  if (error || !data) throw new Error(`Source unavailable: ${path}`);
  return new Uint8Array(await data.arrayBuffer());
}
async function snapshot() {
  const rawPosts = await rows('db_posts');
  const posts = rawPosts.map(
    ({
      id,
      slug,
      published,
      banner_path,
      storage_path,
      updated_at,
      post_revision
    }) => ({
      id,
      slug,
      published,
      banner_path,
      storage_path,
      updated_at,
      ...(post_revision === undefined ? {} : {post_revision})
    })
  );
  const translations = await rows('db_post_translations');
  const referenceRows = [
    ...rawPosts.map(({banner_path, ...row}) => ({table: 'db_posts', row})),
    ...translations.map(row => ({table: 'db_post_translations', row}))
  ];
  for (const table of ['db_profiles', 'db_documents', 'db_legals'])
    for (const row of await rows(table)) referenceRows.push({table, row});
  const allObjects = await objects();
  const documentPaths = [
    ...new Set([
      ...allObjects.filter(path => path.endsWith('.md')),
      ...posts.map(post => post.storage_path),
      ...translations.map(row => row.storage_path).filter(Boolean)
    ])
  ];
  const documents: {path: string; sha256: string; content: string}[] = [];
  for (const path of documentPaths) {
    const bytes = await download(path);
    documents.push({
      path,
      sha256: await sha256(bytes),
      content: new TextDecoder().decode(bytes)
    });
  }
  return {posts, translations, allObjects, documents, referenceRows};
}
async function persist(manifest: BannerMigrationManifest) {
  await writeFile(
    `${manifestPath}.tmp`,
    JSON.stringify(manifest, null, 2) + '\n'
  );
  await rename(`${manifestPath}.tmp`, manifestPath);
}
async function load(): Promise<BannerMigrationManifest> {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.project !== project)
    throw new Error('Manifest belongs to another Supabase project.');
  return manifest;
}
async function sourceFile(path: string) {
  return join(
    directory,
    `${await sha256(new TextEncoder().encode(path))}.source`
  );
}
function r2() {
  return {
    bucket: value('R2_BUCKET_NAME'),
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${value('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: value('R2_ACCESS_KEY_ID'),
        secretAccessKey: value('R2_SECRET_ACCESS_KEY')
      }
    })
  };
}
async function verifyOutput(
  source: BannerMigrationManifest['sources'][number]
) {
  const {client, bucket} = r2();
  const object = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: bannerKey(source.postId, source.version)
    })
  );
  const bytes = await object.Body?.transformToByteArray();
  if (!bytes) throw new Error('R2 object is empty.');
  const data = new Uint8Array(bytes);
  inspectWebp(data);
  if (
    source.output
    && ((await sha256(data)) !== source.output.sha256
      || data.length !== source.output.bytes)
  )
    throw new Error('R2 checksum mismatch.');
  return data;
}

if (mode === 'inventory') {
  const current = await snapshot();
  let previous: BannerMigrationManifest | undefined;
  try {
    previous = await load();
  } catch (error) {
    if ((error as {code?: string}).code !== 'ENOENT') throw error;
  }
  if (previous?.activatedAt)
    throw new Error(
      'An activated manifest cannot be replaced by a new inventory.'
    );
  const sources: BannerMigrationManifest['sources'] = [];
  const paths = [
    ...new Set([
      ...current.allObjects.filter(path => path.startsWith('banners/')),
      ...current.posts.map(post => post.banner_path).filter(Boolean)
    ])
  ].sort();
  for (const path of paths) {
    const bytes = await download(path);
    const hash = await sha256(bytes);
    const old = previous?.sources.find(
      source => source.path === path && source.sha256 === hash
    );
    const references: BannerMigrationManifest['sources'][number]['references'] =
      current.posts
        .filter(post => post.banner_path === path)
        .map(post => ({kind: 'banner', location: `db_posts:${post.id}`}));
    for (const document of current.documents)
      if (
        document.content.includes(path)
        || document.content.includes(encodeURIComponent(path))
      )
        references.push({kind: 'markdown', location: document.path});
    for (const {table, row} of current.referenceRows)
      if (
        JSON.stringify(row).includes(path)
        || JSON.stringify(row).includes(encodeURIComponent(path))
      )
        references.push({kind: 'other', location: `${table}:${row.id}`});
    const source = {
      path,
      sha256: hash,
      bytes: bytes.length,
      postId:
        old?.postId
        || current.posts.find(post => post.banner_path === path)?.id
        || crypto.randomUUID(),
      version: old?.version || crypto.randomUUID(),
      references,
      ...(old?.output ?
        {output: old.output, width: old.width, height: old.height}
      : {})
    };
    sources.push(source);
    await writeFile(await sourceFile(path), bytes);
  }
  const manifest: BannerMigrationManifest = {
    version: 1,
    project,
    createdAt: new Date().toISOString(),
    posts: current.posts,
    documents: current.documents.map(({path, sha256}) => ({path, sha256})),
    sources
  };
  await persist(manifest);
  console.log(
    JSON.stringify({
      manifest: manifestPath,
      posts: manifest.posts.length,
      banners: sources.length,
      references: sources.map(source => ({
        path: source.path,
        bytes: source.bytes,
        references: source.references.length
      }))
    })
  );
} else if (mode === 'prepare') {
  const manifest = await load();
  const current = await snapshot();
  assertMigrationSnapshot(
    manifest,
    current.posts,
    current.documents.map(({path, sha256}) => ({path, sha256}))
  );
  const module = process.env.PLAYWRIGHT_MODULE || 'playwright';
  const {chromium} = await import(module);
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox']
  });
  try {
    const page = await browser.newPage();
    const origin = process.env.BANNER_TEST_ORIGIN || 'http://127.0.0.1:5176';
    if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
      throw new Error('Conversion requires a local development server.');
    await page.goto(`${origin}/admin/login`, {waitUntil: 'domcontentloaded'});
    for (const source of manifest.sources) {
      try {
        if (source.output?.verifiedAt && !source.error) {
          await verifyOutput(source);
          continue;
        }
        const bytes = await download(source.path);
        if ((await sha256(bytes)) !== source.sha256)
          throw new Error('Source changed after inventory.');
        const result = await page.evaluate(async (input: number[]) => {
          const {processBanner} = await import('/src/lib/processBanner.ts');
          const {blob, width, height} = await processBanner(
            new Blob([new Uint8Array(input)]),
            new AbortController().signal,
            true
          );
          return {
            bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
            width,
            height
          };
        }, Array.from(bytes));
        const output = new Uint8Array(result.bytes);
        inspectWebp(output);
        source.width = result.width;
        source.height = result.height;
        const key = bannerKey(source.postId, source.version);
        source.output = {
          key,
          sha256: await sha256(output),
          bytes: output.length,
          verifiedAt: ''
        };
        await writeFile(join(directory, `${source.version}.webp`), output);
        const {client, bucket} = r2();
        try {
          await client.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              Body: output,
              ContentType: 'image/webp',
              CacheControl: 'public, max-age=31536000, immutable',
              IfNoneMatch: '*'
            })
          );
        } catch (error) {
          if (!(error instanceof Error) || error.name !== 'PreconditionFailed')
            throw error;
        }
        await verifyOutput(source);
        source.output.verifiedAt = new Date().toISOString();
        delete source.error;
      } catch (error) {
        source.error =
          error instanceof Error ? error.message : 'Conversion failed.';
        await persist(manifest);
        throw error;
      }
      await persist(manifest);
    }
    verifyBannerManifest(manifest);
    console.log(
      JSON.stringify({
        prepared: manifest.sources.length,
        manifest: manifestPath,
        sources: manifest.sources.map(source => ({
          path: source.path,
          width: source.width,
          height: source.height,
          bytes: source.output?.bytes
        }))
      })
    );
  } finally {
    await browser.close();
  }
} else if (mode === 'verify' || mode === 'stage') {
  const manifest = await load();
  verifyBannerManifest(manifest);
  const current = await snapshot();
  assertMigrationSnapshot(
    manifest,
    current.posts,
    current.documents.map(({path, sha256}) => ({path, sha256}))
  );
  for (const source of manifest.sources) {
    if ((await sha256(await download(source.path))) !== source.sha256)
      throw new Error('Source changed after inventory.');
    await verifyOutput(source);
  }
  if (mode === 'stage') {
    for (const source of manifest.sources) {
      const {error} = await db
        .from('db_blog_banner_versions')
        .upsert(
          {
            id: source.version,
            post_id: source.postId,
            object_key: source.output!.key,
            sha256: source.output!.sha256,
            bytes: source.output!.bytes,
            state: 'staged',
            source_path: source.path,
            retain: source.references.some(
              reference => reference.kind !== 'banner'
            )
          },
          {onConflict: 'id', ignoreDuplicates: true}
        );
      if (error) throw error;
    }
  }
  console.log(
    JSON.stringify({
      verified: manifest.sources.length,
      staged: mode === 'stage'
    })
  );
} else if (mode === 'activate') {
  const manifest = await load();
  verifyBannerManifest(manifest);
  const current = await snapshot();
  assertMigrationSnapshot(
    manifest,
    current.posts,
    current.documents.map(({path, sha256}) => ({path, sha256}))
  );
  for (const source of manifest.sources) await verifyOutput(source);
  const {error} = await db.rpc('db_activate_blog_banner_migration', {
    p_posts: manifest.posts,
    p_sources: manifest.sources
  });
  if (error) throw error;
  manifest.activatedAt = new Date().toISOString();
  await persist(manifest);
  console.log('Banner versions activated. Legacy sources are preserved.');
} else if (mode === 'verify-production' || mode === 'cleanup-sources') {
  const manifest = await load();
  verifyBannerManifest(manifest);
  if (!manifest.activatedAt)
    throw new Error('Activate the verified migration first.');
  const origin = new URL(value('BANNER_PRODUCTION_ORIGIN'));
  if (origin.protocol !== 'https:')
    throw new Error('Production origin must use HTTPS.');
  const current = await snapshot();
  const referenced = new Set<string>();
  for (const source of manifest.sources) {
    await verifyOutput(source);
    const response = await fetch(new URL(`/${source.output!.key}`, origin));
    if (
      !response.ok
      || (await sha256(await response.arrayBuffer())) !== source.output!.sha256
    )
      throw new Error('Production R2 banner verification failed.');
    for (const {row} of current.referenceRows)
      if (
        JSON.stringify(row).includes(source.path)
        || JSON.stringify(row).includes(encodeURIComponent(source.path))
      )
        referenced.add(source.path);
    for (const document of current.documents)
      if (
        document.content.includes(source.path)
        || document.content.includes(encodeURIComponent(source.path))
      )
        referenced.add(source.path);
    for (const post of current.posts.filter(post => post.published)) {
      const html = await fetch(new URL(`/blog/${post.slug}`, origin)).then(
        response => {
          if (!response.ok) throw new Error('Production article unavailable.');
          return response.text();
        }
      );
      if (
        html.includes(source.path)
        || html.includes(encodeURIComponent(source.path))
      )
        referenced.add(source.path);
      if (
        post.banner_path === source.path
        && !html.includes(`/${source.output!.key}`)
      )
        throw new Error('Production is not using the migrated banner.');
    }
  }
  manifest.productionVerifiedAt = new Date().toISOString();
  const paths = migrationCleanupPaths(manifest, referenced);
  await persist(manifest);
  if (mode === 'cleanup-sources') {
    const {error: finalizeError} = await db.rpc(
      'db_finalize_blog_banner_migration',
      {p_sources: manifest.sources}
    );
    if (finalizeError) throw finalizeError;
    for (const path of paths) {
      if (manifest.deletedSources?.includes(path)) continue;
      const source = manifest.sources.find(source => source.path === path)!;
      if ((await sha256(await download(path))) !== source.sha256)
        throw new Error('Source changed; cleanup stopped.');
      const {error} = await db.storage.from('blog-posts').remove([path]);
      if (error) throw error;
      manifest.deletedSources = [...(manifest.deletedSources || []), path];
      await persist(manifest);
    }
  }
  console.log(
    JSON.stringify({
      productionVerified: true,
      cleanup: mode === 'cleanup-sources' ? paths.length : 0
    })
  );
} else
  throw new Error(
    'Use inventory, prepare, verify, stage, activate, verify-production, or cleanup-sources.'
  );
