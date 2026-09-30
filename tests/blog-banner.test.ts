import {expect, test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {bannerCrop, bannerUrl, BANNER_LIMIT} from '../src/lib/blogBanner';
import {inspectWebp} from '../src/lib/webp';
import {encodeBanner, rasterBanner} from '../src/lib/bannerRaster';
import {validateBanner} from '../src/lib/server/validateBanner';
import {boundedBody, parsePostInput} from '../src/lib/server/blogPostInput';

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

test('center crop preserves the aspect ratio for landscape and portrait without upscaling', () => {
  expect(bannerCrop(2560, 640)).toEqual({
    x: 640,
    y: 0,
    width: 1280,
    height: 640
  });
  expect(bannerCrop(1280, 2560)).toEqual({
    x: 0,
    y: 960,
    width: 1280,
    height: 640
  });
  expect(() => bannerCrop(1279, 640)).toThrow('at least');
  expect(() => bannerCrop(1280, 639)).toThrow('at least');
  expect(bannerCrop(64, 64, true)).toEqual({
    x: 0,
    y: 16,
    width: 64,
    height: 32
  });
  expect(() => bannerCrop(10000, 5000)).toThrow('40 megapixels');
});

test('WebP validation checks container, dimensions, size, and actual compressed pixels', async () => {
  expect(inspectWebp(valid)).toMatchObject({
    width: 1280,
    height: 640,
    type: 'image/webp'
  });
  await expect(validateBanner(valid, wasm)).resolves.toMatchObject({
    width: 1280,
    height: 640
  });
  expect(() => inspectWebp(new Uint8Array(BANNER_LIMIT + 1))).toThrow();
  expect(() => inspectWebp(valid.slice(0, -1))).toThrow();
  const corrupt = valid.slice();
  corrupt.fill(255, corrupt.length - 200);
  await expect(validateBanner(corrupt, wasm)).rejects.toThrow();
  const spoofed = valid.slice();
  spoofed[8] = 80;
  expect(() => inspectWebp(spoofed)).toThrow();
});

test('encoder uses only WebP quality 0.8 through 0.4 and fails without changing dimensions or format', async () => {
  const qualities: number[] = [];
  const canvas = {
    convertToBlob: async ({quality}: ImageEncodeOptions = {}) => {
      qualities.push(quality!);
      return new Blob([new Uint8Array(BANNER_LIMIT + 1)], {type: 'image/webp'});
    }
  };
  await expect(encodeBanner(canvas)).rejects.toThrow('500 KiB');
  expect(qualities).toEqual([0.8, 0.7, 0.6, 0.5, 0.4]);
  await expect(
    encodeBanner({
      convertToBlob: async () => new Blob([valid], {type: 'image/png'})
    })
  ).rejects.toThrow('cannot encode WebP');
  await expect(
    encodeBanner({
      convertToBlob: async () => new Blob([valid], {type: 'image/webp'})
    })
  ).resolves.toBeInstanceOf(Blob);
});

test('bounded request reading enforces limits without relying on Content-Length', async () => {
  await expect(
    boundedBody(
      new Request('https://example.com', {method: 'POST', body: '123456'}),
      5
    )
  ).rejects.toThrow('too large');
});

test('source size matches the avatar limit of ten million bytes', async () => {
  await expect(
    rasterBanner(new Blob([new Uint8Array(10_000_001)]))
  ).rejects.toThrow('10 MB');
});

test('server rejects malformed banner operations and accepts verified replacement bytes', async () => {
  const metadata = {
    operationId: crypto.randomUUID(),
    id: crypto.randomUUID(),
    revision: null,
    kind: 'save',
    title: 'Fixture',
    slug: 'fixture',
    excerpt: null,
    tags: ['test'],
    collaborators: [],
    published: false,
    bannerOperation: 'replace'
  };
  const form = new FormData();
  form.set('post', JSON.stringify(metadata));
  form.set('markdown', '# Fixture');
  form.set('banner', new Blob([valid], {type: 'image/png'}), 'spoof.png');
  const parse = () =>
    parsePostInput(
      new Request('https://example.com', {method: 'POST', body: form}),
      wasm
    );
  expect((await parse()).banner).toMatchObject({
    operation: 'replace',
    bytes: valid.length
  });
  form.set(
    'post',
    JSON.stringify({...metadata, revision: 1, bannerOperation: 'keep'})
  );
  await expect(parse()).rejects.toThrow('Unexpected banner');
  form.delete('banner');
  for (const published of [false, true]) {
    form.set(
      'post',
      JSON.stringify({...metadata, published, bannerOperation: 'keep'})
    );
    await expect(parse()).rejects.toThrow('Banner image is required.');
    form.set(
      'post',
      JSON.stringify({
        ...metadata,
        published,
        revision: 1,
        bannerOperation: 'remove'
      })
    );
    await expect(parse()).rejects.toThrow('Banner image is required.');
  }
  form.set(
    'post',
    JSON.stringify({...metadata, revision: 1, bannerOperation: 'keep'})
  );
  expect((await parse()).banner.operation).toBe('keep');
  form.set('post', JSON.stringify({...metadata, revision: -1}));
  await expect(parse()).rejects.toThrow('revision');
});

test('banner URLs are relative and never resolve legacy storage paths', () => {
  const id = crypto.randomUUID(),
    version = crypto.randomUUID();
  expect(bannerUrl({id, banner_version: version})).toBe(
    `/blog/banners/${id}/${version}.webp`
  );
  expect(bannerUrl({id})).toBeNull();
});
