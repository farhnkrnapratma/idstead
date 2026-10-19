import type {
    PostStats,
    PublicComment,
    PublicPostFields,
    RecentComment
} from '@fkp/domain/blog.ts';

export interface PostSource {
    readonly kind: 'post-source';
}

export interface PublishedPost extends PublicPostFields {
    banner_url: string | null;
    read_minutes: number | null;
    source: PostSource;
}

export type PublishedPostWithStats = PublishedPost & PostStats;

export interface PostListOptions {
    limit?: number;
    offset?: number;
    search?: string;
}

export interface PostPage<T> {
    posts: T[];
    total: number;
}

export type PostLookup<T> =
    | { status: 'found'; post: T }
    | { status: 'invalid' }
    | { status: 'not-found' }
    | { status: 'ambiguous' };

export interface ReadOptions {
    timeoutMs?: number;
}

export interface BlogRepository {
    listPublished(options?: PostListOptions): Promise<PostPage<PublishedPost>>;
    listPublishedWithStats(options?: PostListOptions): Promise<PostPage<PublishedPostWithStats>>;
    findPublished(reference: string): Promise<PostLookup<PublishedPost>>;
    getPublishedBySlug(slug: string): Promise<PublishedPost | null>;
    postStats(post: PublishedPost): Promise<PostStats>;
    readMarkdown(source: PostSource, options?: ReadOptions): Promise<string | null>;
    readRender(source: PostSource, options?: ReadOptions): Promise<string | null>;
}

export interface CommentRepository {
    listApproved(post: PublishedPost): Promise<PublicComment[]>;
    listRecentApproved(limit: number): Promise<RecentComment[]>;
}

export interface PostRenderStore {
    listRenderCandidates(limit: number): Promise<PostSource[]>;
    downloadMarkdown(source: PostSource): Promise<string | null>;
    downloadRender(source: PostSource): Promise<string | null>;
    writeRender(source: PostSource, render: string): Promise<void>;
    renderPath(source: PostSource): string | null;
}
