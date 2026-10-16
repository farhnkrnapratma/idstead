import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { assetStorage, IMAGE_CACHE_CONTROL } from './profileAssets';
import { sha256 } from '#lib/blogBanner.ts';

export async function putContentAsset(
    platform: App.Platform | undefined,
    key: string,
    bytes: Uint8Array<ArrayBuffer>,
    contentType: string
) {
    const { client, bucket } = assetStorage(platform);
    await client.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: bytes,
            ContentType: contentType,
            CacheControl: IMAGE_CACHE_CONTROL
        }),
        { abortSignal: AbortSignal.timeout(30_000) }
    );
    const stored = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), {
        abortSignal: AbortSignal.timeout(30_000)
    });
    const data = await stored.Body?.transformToByteArray();
    if (!data || (await sha256(new Uint8Array(data))) !== (await sha256(bytes)))
        throw new Error('Stored content asset verification failed.');
}
