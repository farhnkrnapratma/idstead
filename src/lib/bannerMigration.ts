import {bannerKey, BANNER_LIMIT, UUID_PATTERN} from './blogBanner';

export type BannerMigrationManifest = {
  version: 1;
  project: string;
  createdAt: string;
  posts: {
    id: string;
    slug: string;
    published: boolean;
    banner_path: string | null;
    storage_path: string;
    updated_at: string;
    post_revision?: number;
  }[];
  documents: {path: string; sha256: string}[];
  sources: {
    path: string;
    sha256: string;
    bytes: number;
    width?: number;
    height?: number;
    postId: string;
    version: string;
    references: {kind: 'banner' | 'markdown' | 'other'; location: string}[];
    output?: {key: string; sha256: string; bytes: number; verifiedAt: string};
    error?: string;
  }[];
  activatedAt?: string;
  productionVerifiedAt?: string;
  deletedSources?: string[];
};

export function verifyBannerManifest(manifest: BannerMigrationManifest) {
  if (
    manifest.version !== 1
    || !Array.isArray(manifest.sources)
    || !Array.isArray(manifest.posts)
  )
    throw new Error('Invalid migration manifest.');
  const paths = new Set<string>();
  for (const source of manifest.sources) {
    if (
      paths.has(source.path)
      || !source.path.startsWith('banners/')
      || source.path.includes('..')
      || !UUID_PATTERN.test(source.postId)
      || !UUID_PATTERN.test(source.version)
    )
      throw new Error('Unsafe or duplicate migration source.');
    paths.add(source.path);
    if (
      source.error
      || !source.output
      || !source.output.verifiedAt
      || source.output.key !== bannerKey(source.postId, source.version)
      || !/^[0-9a-f]{64}$/.test(source.sha256)
      || !/^[0-9a-f]{64}$/.test(source.output.sha256)
      || source.output.bytes > BANNER_LIMIT
      || source.output.bytes < 1
    )
      throw new Error(`Migration source is not verified: ${source.path}`);
  }
  for (const post of manifest.posts)
    if (post.banner_path && !paths.has(post.banner_path))
      throw new Error(`Post banner is missing from the manifest: ${post.id}`);
}

export function assertMigrationSnapshot(
  manifest: BannerMigrationManifest,
  posts: BannerMigrationManifest['posts'],
  documents: BannerMigrationManifest['documents']
) {
  const canonical = (value: unknown) => JSON.stringify(value);
  const sortPosts = (items: BannerMigrationManifest['posts']) =>
    [...items]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(({id, slug, published, banner_path, storage_path, updated_at}) => ({
        id,
        slug,
        published,
        banner_path,
        storage_path,
        updated_at
      }));
  if (canonical(sortPosts(manifest.posts)) !== canonical(sortPosts(posts)))
    throw new Error(
      'Posts changed after inventory. Refresh the inventory before activation.'
    );
  const sortDocuments = (items: BannerMigrationManifest['documents']) =>
    [...items].sort((a, b) => a.path.localeCompare(b.path));
  if (
    canonical(sortDocuments(manifest.documents))
    !== canonical(sortDocuments(documents))
  )
    throw new Error(
      'Markdown changed after inventory. Refresh the inventory before activation.'
    );
}

export function migrationCleanupPaths(
  manifest: BannerMigrationManifest,
  referencedPaths: Set<string>
) {
  verifyBannerManifest(manifest);
  if (!manifest.activatedAt || !manifest.productionVerifiedAt)
    throw new Error(
      'Deployment and Production verification are required before source cleanup.'
    );
  const referenced = manifest.sources.filter(source =>
    referencedPaths.has(source.path)
  );
  if (referenced.length)
    throw new Error(
      `Legacy references remain: ${referenced.map(source => source.path).join(', ')}`
    );
  return manifest.sources.map(source => source.path);
}
