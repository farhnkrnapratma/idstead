import type { BannerCredit, ContentLicenseId } from '@idstead/domain/contentLicense.ts';

export interface AdminPost {
    id: string;
    title: string;
    slug: string;
    published: boolean;
    pinned: boolean;
    storage_path: string | null;
    created_at: string;
    updated_at: string | null;
    banner_version: string | null;
    post_revision: number;
    excerpt: string | null;
    tags: string[];
    helpful_yes: number;
    helpful_no: number;
    read_minutes: number | null;
    views_count: number;
    comment_count: number;
}

export interface AdminPostDraft {
    id: string;
    title: string;
    slug: string;
    published: boolean;
    banner_version: string | null;
    post_revision: number;
    excerpt: string | null;
    tags: string[];
    collaborators: string[];
    content_license: ContentLicenseId | null;
    banner_credit: BannerCredit | null;
    markdown: string | null;
}

export interface PostAssetState {
    id: string;
    slug: string;
    published: boolean;
    banner_version: string | null;
}

export interface PostFlags {
    published?: boolean;
    pinned?: boolean;
}

export type PostFlagsUpdate =
    | { status: 'updated'; post: PostAssetState & { post_revision: number; pinned: boolean } }
    | { status: 'not-found' }
    | { status: 'excerpt-required' }
    | { status: 'pin-limit' };

export interface AdminPostStore {
    list(): Promise<AdminPost[]>;
    get(id: string): Promise<AdminPostDraft | null>;
    assetState(id: string): Promise<PostAssetState | null>;
    slugTaken(slug: string, exceptId: string): Promise<boolean>;
    exists(id: string): Promise<boolean>;
    setFlags(id: string, flags: PostFlags): Promise<PostFlagsUpdate>;
}

export type PostOperationState = 'pending' | 'ready' | 'committed' | 'conflict' | 'rejected';

export interface PostOperation {
    id: string;
    state: PostOperationState;
    result: {
        id: string;
        post_revision?: number;
        banner_version?: string | null;
        slug?: string;
        published?: boolean;
        deleted?: boolean;
    } | null;
}

export interface PostOperationRequest {
    operationId: string;
    actor: string;
    postId: string;
    hash: string;
    revision: number | null;
    kind: 'save' | 'delete';
    post: Record<string, unknown>;
    banner: { operation: string } & Record<string, unknown>;
}

export type PostOperationPreparation =
    { status: 'prepared'; operation: PostOperation } | { status: 'reused' };

export interface PostOperationStore {
    prepare(request: PostOperationRequest): Promise<PostOperationPreparation>;
    revision(
        postId: string
    ): Promise<{ post_revision: number; banner_version: string | null } | null>;
    writeMarkdown(postId: string, operationId: string, markdown: string): Promise<void>;
    writeRender(postId: string, operationId: string, render: string): Promise<void>;
    ready(operationId: string, actor: string): Promise<void>;
    commit(operationId: string, actor: string): Promise<PostOperation>;
    find(operationId: string, actor: string): Promise<PostOperation | null>;
}

export interface BannerCleanup {
    id: string;
    post_id: string;
    object_key: string;
}

export interface MarkdownCleanup {
    storage_path: string;
    cleanup_attempts: number;
}

export interface PostCleanupStore {
    claimBanners(): Promise<BannerCleanup[]>;
    bannerRemoved(id: string): Promise<void>;
    bannerFailed(id: string): Promise<void>;
    pendingMarkdown(olderThan: Date, limit: number): Promise<MarkdownCleanup[]>;
    markdownInUse(path: string): Promise<boolean>;
    removeMarkdown(paths: string[]): Promise<void>;
    markdownRemoved(path: string): Promise<void>;
    markdownFailed(item: MarkdownCleanup): Promise<void>;
}
