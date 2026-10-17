import { IMAGE_CACHE_CONTROL } from './profileAssets';
import { assetBucket, readObjectBytes } from './r2';
import { sha256 } from '#lib/blogBanner.ts';

export async function putContentAsset(
    platform: App.Platform | undefined,
    key: string,
    bytes: Uint8Array<ArrayBuffer>,
    contentType: string
) {
    const bucket = await assetBucket(platform);
    await bucket.put(key, bytes, {
        httpMetadata: { contentType, cacheControl: IMAGE_CACHE_CONTROL }
    });
    const data = await readObjectBytes(bucket, key);
    if (!data || (await sha256(data)) !== (await sha256(bytes)))
        throw new Error('Stored content asset verification failed.');
}
