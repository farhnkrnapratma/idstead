import {
    CopyObjectCommand,
    DeleteObjectsCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client
} from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { CV_CHECKSUM_EXTENSIONS, cvChecksums, cvKey } from '../packages/lib/src/server/cvChecksums';
import { formatCvVersion, parseCvVersion } from '../packages/lib/src/cvVersion';

const mode = Bun.argv.slice(2).find(arg => !arg.startsWith('--')) ?? 'dry-run';
if (!['dry-run', 'apply'].includes(mode))
    throw new Error('Usage: migrate-cdn-layout.ts [dry-run|apply]');

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
const cdn = value('PUBLIC_CDN_BASE_URL').trim().replace(/\/+$/, '');
const bucket = value('R2_BUCKET_NAME');
const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${value('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: value('R2_ACCESS_KEY_ID'),
        secretAccessKey: value('R2_SECRET_ACCESS_KEY')
    }
});

async function list(prefix: string, delimiter?: string) {
    const keys: string[] = [];
    let token: string | undefined;
    do {
        const page = await r2.send(
            new ListObjectsV2Command({
                Bucket: bucket,
                Prefix: prefix,
                Delimiter: delimiter,
                ContinuationToken: token
            })
        );
        for (const item of page.Contents ?? []) if (item.Key) keys.push(item.Key);
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return keys;
}

const { data: doc, error: docError } = await db
    .from('db_documents')
    .select('id, filename, file_url')
    .eq('is_active', true)
    .maybeSingle();
if (docError) throw new Error(`Cannot read db_documents: ${docError.message}`);

const rootFiles = (await list('', '/')).filter(key => /\.pdf(?:\.sha256)?$/.test(key));
const { data: posts, error: postsError } = await db.from('db_posts').select('id');
if (postsError) throw new Error(`Cannot read db_posts: ${postsError.message}`);
const livePosts = new Set((posts ?? []).map(post => post.id as string));
const leftovers = [...(await list('blog/content/')), ...(await list('blog/banners/'))].filter(
    key => !livePosts.has(key.split('/')[2] ?? '')
);

let cvPlan: { from: string; filename: string; version: string } | null = null;
if (doc?.filename && rootFiles.includes(doc.filename)) {
    const version = formatCvVersion(parseCvVersion(doc.filename) ?? { major: 1, minor: 0 });
    const filename = doc.filename.replace(/-v\d+\.\d+(?:\.\d+)?\.pdf$/i, `-v${version}.pdf`);
    cvPlan = { from: doc.filename, filename, version };
    console.log(
        `CV: ${doc.filename} -> ${cvKey(filename)} (+ ${CV_CHECKSUM_EXTENSIONS.length} checksums)`
    );
} else console.log('CV: nothing to move (no active CV at the bucket root).');
const obsolete = rootFiles.filter(key => key !== cvPlan?.from);
for (const key of obsolete) console.log(`delete ${key}`);
for (const key of leftovers) console.log(`delete ${key}`);

if (mode === 'dry-run') {
    console.log(
        `\nDry run: ${cvPlan ? 1 : 0} CV move, ${obsolete.length + leftovers.length} leftover object(s). Run with "apply" to save.`
    );
    process.exit(0);
}

if (cvPlan && doc) {
    const object = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: cvPlan.from }));
    const pdf = await object.Body!.transformToByteArray();
    const { digests, files } = await cvChecksums(pdf, cvPlan.filename);
    await r2.send(
        new CopyObjectCommand({
            Bucket: bucket,
            Key: cvKey(cvPlan.filename),
            CopySource: `${bucket}/${cvPlan.from}`,
            MetadataDirective: 'REPLACE',
            ContentType: 'application/pdf',
            CacheControl: 'public, max-age=300'
        })
    );
    for (const ext of CV_CHECKSUM_EXTENSIONS)
        await r2.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: cvKey(cvPlan.filename, ext),
                Body: new TextEncoder().encode(files[ext]),
                ContentType: 'text/plain; charset=utf-8',
                CacheControl: 'public, max-age=300'
            })
        );
    const { error } = await db
        .from('db_documents')
        .update({
            filename: cvPlan.filename,
            file_url: `${cdn}/${cvKey(cvPlan.filename)}`,
            hash: digests.sha256,
            version: cvPlan.version
        })
        .eq('id', doc.id);
    if (error) throw new Error(`Cannot update db_documents: ${error.message}`);
    obsolete.push(cvPlan.from, `${cvPlan.from}.sha256`);
}

const remove = [...new Set([...obsolete, ...leftovers])];
for (let index = 0; index < remove.length; index += 1000)
    await r2.send(
        new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: remove.slice(index, index + 1000).map(Key => ({ Key })) }
        })
    );
console.log(`\nMoved the CV and removed ${remove.length} object(s).`);
