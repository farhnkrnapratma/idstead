import {expect, test} from 'bun:test';
import {
  assertMigrationSnapshot,
  migrationCleanupPaths,
  verifyBannerManifest,
  type BannerMigrationManifest
} from '../src/lib/bannerMigration';
import {bannerKey} from '../src/lib/blogBanner';

const postId = '11111111-1111-4111-8111-111111111111';
const version = '22222222-2222-4222-8222-222222222222';
function fixture(): BannerMigrationManifest {
  return {
    version: 1,
    project: 'https://example.com',
    createdAt: 'now',
    posts: [
      {
        id: postId,
        slug: 'test',
        published: true,
        banner_path: 'banners/test.png',
        storage_path: 'test.md',
        updated_at: 'now'
      }
    ],
    documents: [{path: 'test.md', sha256: 'a'.repeat(64)}],
    sources: [
      {
        path: 'banners/test.png',
        postId,
        version,
        sha256: 'b'.repeat(64),
        bytes: 1000,
        references: [],
        output: {
          key: bannerKey(postId, version),
          sha256: 'c'.repeat(64),
          bytes: 500,
          verifiedAt: 'now'
        }
      }
    ]
  };
}
test('migration requires complete verification and detects post/document drift', () => {
  const manifest = fixture();
  expect(() => verifyBannerManifest(manifest)).not.toThrow();
  expect(() =>
    assertMigrationSnapshot(manifest, manifest.posts, manifest.documents)
  ).not.toThrow();
  expect(() =>
    assertMigrationSnapshot(
      manifest,
      [{...manifest.posts[0], published: false}],
      manifest.documents
    )
  ).toThrow('Posts changed');
  expect(() =>
    assertMigrationSnapshot(manifest, manifest.posts, [
      {path: 'test.md', sha256: 'changed'}
    ])
  ).toThrow('Markdown changed');
  delete manifest.sources[0].output;
  expect(() => verifyBannerManifest(manifest)).toThrow('not verified');
});
test('cleanup is limited to manifest banner objects, requires Production verification, and blocks inline references', () => {
  const manifest = fixture();
  expect(() => migrationCleanupPaths(manifest, new Set())).toThrow(
    'Production verification'
  );
  manifest.activatedAt = 'now';
  manifest.productionVerifiedAt = 'now';
  expect(() =>
    migrationCleanupPaths(manifest, new Set(['banners/test.png']))
  ).toThrow('Legacy references remain');
  expect(
    migrationCleanupPaths(
      manifest,
      new Set(['inline/unrelated.png', 'test.md', 'avatar.png'])
    )
  ).toEqual(['banners/test.png']);
  manifest.sources[0].path = 'avatar.png';
  expect(() => migrationCleanupPaths(manifest, new Set())).toThrow('Unsafe');
});
