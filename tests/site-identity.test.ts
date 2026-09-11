import {describe, expect, test} from 'bun:test';
import {readFile, readdir} from 'node:fs/promises';
import UPNG from 'upng-js';
import {encodePng, crc32} from '../src/lib/png';
import {deflate} from 'pako';
import {buildSvg, makeIco} from '../src/lib/siteIdentity';
import {
  validatePng,
  validateIco,
  validateAvatar
} from '../src/lib/server/validateAvatar';
import {publicResponse} from '../src/lib/server/publicResponse';
import {
  skillDocument,
  contentDigest,
  discoveryOperations
} from '../src/lib/server/apiDiscovery';

function png(size: number) {
  const pixels = new Uint8Array(size * size * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = (i / 4) % 255;
    pixels[i + 1] = 127;
    pixels[i + 3] = 255;
  }
  return encodePng(pixels, size, size);
}

describe('image package validation', () => {
  test('accepts encoder PNGs and the three ICO sizes', () => {
    for (const size of [16, 32, 48, 180, 192, 512])
      expect(() => validatePng(png(size), size)).not.toThrow();
    const ico = makeIco([16, 32, 48].map(size => ({size, data: png(size)})));
    expect(() => validateIco(ico)).not.toThrow();
    new DataView(ico).setUint32(18, 0, true);
    expect(() => validateIco(ico)).toThrow();
  });
  test('rejects mismatched dimensions, truncated files, oversized files', () => {
    expect(() => validatePng(png(32), 512)).toThrow();
    expect(() => validatePng(png(32).slice(0, 45), 32)).toThrow();
    expect(() => validatePng(new ArrayBuffer(500001), 32)).toThrow();
  });
  test('bounds decompression before decoding pixels', () => {
    const header = new Uint8Array(png(16).slice(0, 33));
    const compressed = deflate(new Uint8Array(2_000_000));
    const result = new Uint8Array(33 + 12 + compressed.length + 12);
    result.set(header);
    const view = new DataView(result.buffer);
    view.setUint32(33, compressed.length);
    result.set(new TextEncoder().encode('IDAT'), 37);
    result.set(compressed, 41);
    result.set(new TextEncoder().encode('IEND'), result.length - 8);
    view.setUint32(
      41 + compressed.length,
      crc32(result.subarray(37, 41 + compressed.length))
    );
    view.setUint32(
      result.length - 4,
      crc32(result.subarray(result.length - 8, result.length - 4))
    );
    expect(() => validatePng(result.buffer, 16)).toThrow('decompression limit');
  });
  test('rejects incomplete or duplicate upload fields', async () => {
    const form = new FormData();
    form.set('profile', '{}');
    expect(await validateAvatar(form)).toBeNull();
    form.set('avatar.png', new Blob([png(512)]), 'avatar.png');
    await expect(validateAvatar(form)).rejects.toThrow();
  });
  test('only renders bounded SVG paths and colors', () => {
    const path = {
      d: 'M 0 0 L 128 0 Q 128 128 0 128 Z',
      fill: '#aabbcc',
      opacity: 1
    };
    expect(buildSvg([path])).toContain('viewBox="0 0 128 128"');
    for (const invalid of [
      {...path, d: '"><script>alert(1)</script>'},
      {...path, fill: 'url(https://example.com)'},
      {...path, opacity: NaN}
    ])
      expect(() => buildSvg([invalid])).toThrow();
    expect(() => buildSvg(Array(10001).fill(path))).toThrow();
  });
});

describe('metadata representations', () => {
  test('public handlers stay read-only and document every endpoint error', async () => {
    const root = new URL('../src/routes/api/v1/', import.meta.url);
    const readme = await readFile(new URL('README.md', root), 'utf8');
    const handlers = (await readdir(root, {recursive: true})).filter(path =>
      path.endsWith('+server.ts')
    );
    for (const path of handlers) {
      const code = await readFile(new URL(path, root), 'utf8');
      expect(code).not.toMatch(
        /export\s+(?:const|function)\s+(?:POST|PUT|PATCH|DELETE)\b/
      );
      for (const match of code.matchAll(/apiError\(\s*\d+,\s*'([A-Z_]+)'/g))
        expect(readme).toContain('`' + match[1] + '`');
    }
    const helper = await readFile(
      new URL('../src/lib/server/authorResponse.ts', import.meta.url),
      'utf8'
    );
    for (const match of helper.matchAll(/apiError\(\s*\d+,\s*'([A-Z_]+)'/g))
      expect(readme).toContain('`' + match[1] + '`');
  });
  test('revalidates weak and list ETags without response bodies', async () => {
    const initial = await publicResponse(
      new Request('https://example.com'),
      '{"name":"A"}',
      'application/json'
    );
    const tag = initial.headers.get('etag');
    const request = new Request('https://example.com', {
      headers: {'If-None-Match': `"other", W/${tag}`}
    });
    const cached = await publicResponse(
      request,
      '{"name":"A"}',
      'application/json'
    );
    expect(cached.status).toBe(304);
    expect(await cached.text()).toBe('');
    expect(
      (await publicResponse(request, '{"name":"B"}', 'application/json')).status
    ).toBe(200);
    expect(
      await (
        await publicResponse(
          new Request('https://example.com', {method: 'HEAD'}),
          'abc',
          'text/plain'
        )
      ).text()
    ).toBe('');
  });
  test('all discovery entries resolve to Markdown with matching byte digests', async () => {
    const operations = discoveryOperations();
    expect(new Set(operations.map(item => item.name)).size).toBe(
      operations.length
    );
    for (const operation of operations) {
      const document = skillDocument(operation.name, 'https://example.com');
      if (!document) throw new Error('Missing skill document');
      expect(document.startsWith('---\nname:')).toBe(true);
      const digest = await contentDigest(document);
      const independent = new Bun.CryptoHasher('sha256')
        .update(document)
        .digest('hex');
      expect(digest).toBe(`sha256:${independent}`);
    }
    expect(skillDocument('missing', 'https://example.com')).toBeNull();
  });
});
