import {PutObjectCommand, GetObjectCommand} from '@aws-sdk/client-s3';
import {assetStorage} from './profileAssets';
import {sha256} from '#lib/blogBanner.ts';

export async function putContentAsset(
  platform: App.Platform | undefined,
  key: string,
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string
) {
  const {client, bucket} = assetStorage(platform);
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
        IfNoneMatch: '*'
      }),
      {abortSignal: AbortSignal.timeout(30_000)}
    );
  } catch (error) {
    if (
      !(error instanceof Error)
      || !['PreconditionFailed', 'ConditionalRequestConflict'].includes(
        error.name
      )
    )
      throw error;
  }
  const stored = await client.send(
    new GetObjectCommand({Bucket: bucket, Key: key}),
    {abortSignal: AbortSignal.timeout(30_000)}
  );
  const data = await stored.Body?.transformToByteArray();
  if (!data || (await sha256(new Uint8Array(data))) !== (await sha256(bytes)))
    throw new Error('Stored content asset verification failed.');
}

export async function getContentAsset(
  platform: App.Platform | undefined,
  key: string
) {
  const {client, bucket} = assetStorage(platform);
  return client.send(new GetObjectCommand({Bucket: bucket, Key: key}), {
    abortSignal: AbortSignal.timeout(30_000)
  });
}
