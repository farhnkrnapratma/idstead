import {expect, test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {inspectWebp} from '../src/lib/webp';
import {BANNER_LIMIT, BANNER_WIDTH, BANNER_HEIGHT} from '../src/lib/blogBanner';
import {
  CONTENT_IMAGE_LIMIT,
  CONTENT_IMAGE_PIXEL_LIMIT,
  contentImageKey
} from '../src/lib/blogContentImage';
import {contentKey, SHA256_HEX_PATTERN} from '../src/lib/blogContent';
import {encodeContentImage} from '../src/lib/contentImageRaster';
import {validateContentImage} from '../src/lib/server/validateContentImage';

const valid = new Uint8Array(
  await readFile(new URL('./fixtures/banner/transparent.webp', import.meta.url))
);
const wasm = await WebAssembly.compile(
  await readFile(
    createRequire(import.meta.url).resolve(
      '@jsquash/webp/codec/dec/webp_dec.wasm'
    )
  )
);

test('inspectWebp defaults preserve banner behavior unchanged', () => {
  expect(inspectWebp(valid)).toMatchObject({
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    type: 'image/webp'
  });
  expect(() => inspectWebp(new Uint8Array(BANNER_LIMIT + 1))).toThrow();
});

test('inspectWebp with content-image limits accepts arbitrary dimensions but enforces a pixel ceiling', () => {
  expect(
    inspectWebp(valid, {
      maxBytes: CONTENT_IMAGE_LIMIT,
      maxPixels: CONTENT_IMAGE_PIXEL_LIMIT
    })
  ).toMatchObject({width: BANNER_WIDTH, height: BANNER_HEIGHT});
  expect(() =>
    inspectWebp(valid, {maxBytes: CONTENT_IMAGE_LIMIT, maxPixels: 100})
  ).toThrow();
  expect(() => inspectWebp(valid, {maxBytes: 10})).toThrow();
});

test('validateContentImage decode-verifies actual pixels for arbitrary dimensions', async () => {
  await expect(validateContentImage(valid, wasm)).resolves.toMatchObject({
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT
  });
  const corrupt = valid.slice();
  corrupt.fill(255, corrupt.length - 200);
  await expect(validateContentImage(corrupt, wasm)).rejects.toThrow();
});

test('encodeContentImage tries quality 0.8 through 0.4 and fails clean over budget', async () => {
  const qualities: number[] = [];
  const canvas = {
    convertToBlob: async ({quality}: ImageEncodeOptions = {}) => {
      qualities.push(quality!);
      return new Blob([new Uint8Array(CONTENT_IMAGE_LIMIT + 1)], {
        type: 'image/webp'
      });
    }
  };
  await expect(encodeContentImage(canvas)).rejects.toThrow(
    'cannot be compressed'
  );
  expect(qualities).toEqual([0.8, 0.7, 0.6, 0.5, 0.4]);
});

test('content keys are content-addressed and reject malformed hashes', () => {
  const hash = 'a'.repeat(64);
  expect(SHA256_HEX_PATTERN.test(hash)).toBe(true);
  expect(contentKey(hash, 'webp')).toBe(`blog/content/${hash}.webp`);
  expect(contentImageKey(hash)).toBe(`blog/content/${hash}.webp`);
  expect(() => contentKey('not-a-hash', 'webp')).toThrow(
    'Invalid content hash'
  );
});
