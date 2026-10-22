import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { plugin } from 'bun';
import {
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    S3Client
} from '@aws-sdk/client-s3';

const [outDir, stampArg] = Bun.argv.slice(2).filter(arg => !arg.startsWith('--'));
if (!outDir) throw new Error('Usage: export-site-data.ts <output-directory> [stamp]');

const value = (name: string) => {
    const result = process.env[name];
    if (!result) throw new Error(`Missing configuration: ${name}`);
    return result;
};

const environment = { ...process.env };
plugin({
    name: 'sveltekit-env',
    setup(build) {
        for (const name of ['$app/env/private', '$app/env/public'])
            build.module(name, () => ({ exports: environment, loader: 'object' }));
    }
});

const bucketName = value('R2_BUCKET_NAME');
const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${value('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: value('R2_ACCESS_KEY_ID'),
        secretAccessKey: value('R2_SECRET_ACCESS_KEY')
    }
});

function stored(
    key: string,
    etag: string | undefined,
    uploaded: Date | undefined,
    contentType?: string
) {
    const tag = (etag ?? '').replace(/"/g, '');
    return {
        key,
        etag: tag,
        httpEtag: `"${tag}"`,
        uploaded: uploaded ?? new Date(0),
        httpMetadata: contentType ? { contentType } : {}
    };
}

const readOnly = () => {
    throw new Error('The export only reads object storage.');
};

const assetBucket = {
    async head(key: string) {
        try {
            const head = await r2.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
            return stored(key, head.ETag, head.LastModified, head.ContentType);
        } catch {
            return null;
        }
    },
    async get(key: string) {
        try {
            const object = await r2.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
            const bytes = new Uint8Array(await object.Body!.transformToByteArray());
            return {
                ...stored(key, object.ETag, object.LastModified, object.ContentType),
                body: new Response(bytes).body!,
                arrayBuffer: async () => bytes.buffer
            };
        } catch {
            return null;
        }
    },
    put: readOnly,
    delete: readOnly,
    async list(options: { prefix?: string; cursor?: string } = {}) {
        const page = await r2.send(
            new ListObjectsV2Command({
                Bucket: bucketName,
                Prefix: options.prefix,
                ContinuationToken: options.cursor
            })
        );
        return {
            objects: (page.Contents ?? []).map(item =>
                stored(item.Key ?? '', item.ETag, item.LastModified)
            ),
            truncated: Boolean(page.IsTruncated),
            cursor: page.NextContinuationToken
        };
    }
};

const { dataStores } = await import('../packages/lib/src/server/data.ts');
const { buildDataExport } = await import('../packages/lib/src/server/dataExport.ts');
const platform = { env: { ...environment, ASSET_BUCKET: assetBucket } };
const service = dataStores(platform).service;
if (!service) throw new Error('The data export needs SUPABASE_SERVICE_ROLE_KEY.');
const { zip, stamp, warnings } = await buildDataExport(
    service,
    platform as unknown as App.Platform,
    stampArg ?? null
);
await mkdir(outDir, { recursive: true });
const file = path.join(path.resolve(outDir), `data-export_${stamp}.zip`);
await writeFile(file, zip);
console.log(`Wrote ${file} (${zip.byteLength} bytes).`);
for (const warning of warnings) console.warn(`Warning: ${warning}`);
