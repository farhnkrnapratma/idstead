import {
    CopyObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    S3Client
} from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { bannerKey, canonicalBannerKey } from '../packages/lib/src/blogBanner';
import { identityAssetNames } from '../packages/lib/src/siteIdentity';

const mode = Bun.argv.slice(2).find(arg => !arg.startsWith('--')) ?? 'dry-run';
if (!['dry-run', 'apply'].includes(mode))
    throw new Error('Usage: promote-canonical-images.ts [dry-run|apply]');

const value = (name: string) => {
    const result = process.env[name];
    if (!result) throw new Error(`Missing configuration: ${name}`);
    return result;
};
const project = value('PUBLIC_SUPABASE_URL')
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/$/, '');
const db = createClient(project, value('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false }
});
const bucket = value('R2_BUCKET_NAME');
const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${value('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: value('R2_ACCESS_KEY_ID'),
        secretAccessKey: value('R2_SECRET_ACCESS_KEY')
    }
});

const contentTypes: Record<string, string> = {
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    webp: 'image/webp',
    avif: 'image/avif',
    png: 'image/png'
};

async function exists(key: string) {
    try {
        await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
    } catch (error) {
        if (error instanceof Error && ['NotFound', 'NoSuchKey'].includes(error.name)) return false;
        throw error;
    }
}

const moves: { from: string; to: string }[] = [];

const { data: profile, error: profileError } = await db
    .from('db_profiles')
    .select('avatar_version')
    .order('created_at')
    .limit(1)
    .maybeSingle();
if (profileError) throw new Error(`Cannot read db_profiles: ${profileError.message}`);
if (profile?.avatar_version)
    for (const name of identityAssetNames) {
        const from = `identity/${profile.avatar_version}/${name}`;
        if (await exists(from)) moves.push({ from, to: `identity/${name}` });
    }

const { data: posts, error: postsError } = await db
    .from('db_posts')
    .select('id, banner_version')
    .not('banner_version', 'is', null);
if (postsError) throw new Error(`Cannot read db_posts: ${postsError.message}`);
for (const post of posts ?? [])
    for (const format of ['webp', 'avif'] as const) {
        const from = bannerKey(post.id, post.banner_version, format);
        if (await exists(from)) moves.push({ from, to: canonicalBannerKey(post.id, format) });
    }

for (const move of moves) console.log(`${move.from} -> ${move.to}`);

if (mode === 'dry-run') {
    console.log(`\nDry run: ${moves.length} file(s) would move. Run with "apply" to save.`);
    process.exit(0);
}

for (const move of moves) {
    await r2.send(
        new CopyObjectCommand({
            Bucket: bucket,
            Key: move.to,
            CopySource: `${bucket}/${move.from}`,
            MetadataDirective: 'REPLACE',
            ContentType: contentTypes[move.to.split('.').pop() ?? ''] ?? 'application/octet-stream',
            CacheControl: 'public, max-age=300'
        })
    );
    await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: move.from }));
}
console.log(`\nMoved ${moves.length} file(s) to their canonical keys.`);
