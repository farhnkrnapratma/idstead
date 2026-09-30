import {expect, test} from 'bun:test';
import {
  CONTENT_VIDEO_LIMIT,
  sniffVideoFormat,
  contentVideoKey
} from '../src/lib/blogContentVideo';
import {contentKey} from '../src/lib/blogContent';

function mp4Bytes() {
  const bytes = new Uint8Array(12);
  bytes.set([0, 0, 0, 0x18], 0);
  bytes.set(
    [...'ftyp'].map(c => c.charCodeAt(0)),
    4
  );
  return bytes;
}

function webmBytes() {
  return new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]);
}

test('sniffVideoFormat recognizes MP4 ftyp and WebM EBML headers', () => {
  expect(sniffVideoFormat(mp4Bytes())).toEqual({
    ext: 'mp4',
    contentType: 'video/mp4'
  });
  expect(sniffVideoFormat(webmBytes())).toEqual({
    ext: 'webm',
    contentType: 'video/webm'
  });
});

test('sniffVideoFormat rejects spoofed extensions and unrelated bytes', () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  expect(sniffVideoFormat(png)).toBeNull();
  expect(sniffVideoFormat(new Uint8Array(0))).toBeNull();
  expect(sniffVideoFormat(new Uint8Array(3))).toBeNull();
});

test('content video keys are content-addressed and reject malformed hashes', () => {
  const hash = 'b'.repeat(64);
  expect(contentVideoKey(hash, 'mp4')).toBe(`blog/content/${hash}.mp4`);
  expect(contentVideoKey(hash, 'webm')).toBe(contentKey(hash, 'webm'));
  expect(() => contentVideoKey('short', 'mp4')).toThrow('Invalid content hash');
});

test('video size cap is fifty megabytes', () => {
  expect(CONTENT_VIDEO_LIMIT).toBe(50_000_000);
});
