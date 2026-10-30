import type { Project } from '@idstead/domain/types.ts';
import { formatReadTime } from '@idstead/domain/formatters.ts';
import { decodeHtmlEntities } from '@mdrs/core';
import { avifSources } from '#lib/blogBanner.ts';
import type { ImageSource } from '@idstead/ui/types.ts';
import { isRepoNew, isRepoPinned } from './projectLists';

const NEW_POST_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ContentCardImage {
    src: string;
    alt: string;
    sources?: ImageSource[];
}

export interface PostCardSource {
    slug: string;
    title: string;
    excerpt?: string | null;
    pinned?: boolean;
    created_at: string;
    updated_at?: string | null;
    read_time?: string;
    comment_count?: number;
    views_count?: number;
    tags?: string[];
    banner_url?: string | null;
}

function isNewPost(createdAt: string, now = Date.now()): boolean {
    return !!createdAt && now - new Date(createdAt).getTime() < NEW_POST_WINDOW_MS;
}

function cardImage(src: string | null | undefined): ContentCardImage | null {
    return src ? { src, alt: '', sources: avifSources(src) } : null;
}

export function postCard(post: PostCardSource, options: { banner?: boolean } = {}) {
    return {
        title: post.title,
        href: `/blog/${post.slug}`,
        shortcutGroup: 'posts',
        viewTransitionName: `post-title-${post.slug}`,
        image: options.banner ? cardImage(post.banner_url) : null,
        pinned: !!post.pinned,
        pinnedLabel: 'Pinned post',
        isNew: isNewPost(post.created_at),
        newLabel: 'New post',
        description: post.excerpt,
        tags: (post.tags ?? []).map(decodeHtmlEntities),
        tagHref: (tag: string) => `/blog?tag=${encodeURIComponent(tag)}`,
        tagAriaLabel: (tag: string) => `Show posts tagged ${tag}`
    };
}

export function postCardMeta(post: PostCardSource) {
    return {
        size: 'xs' as const,
        layout: 'single' as const,
        class: 'min-h-4.5',
        date: post.created_at,
        updatedAt: post.updated_at,
        readingTime: formatReadTime(post.read_time),
        commentsCount: post.comment_count || undefined,
        views: post.views_count || undefined
    };
}

export function projectCard(project: Project, pinnedNames: string[]) {
    return {
        title: project.name,
        href: project.url,
        external: true,
        shortcutGroup: 'projects',
        image: cardImage(project.openGraphImageUrl),
        pinned: isRepoPinned(project, pinnedNames),
        pinnedLabel: 'Pinned repository',
        isNew: isRepoNew(project),
        newLabel: 'New repository',
        description: project.desc,
        tags: project.tags ?? [],
        tagNoun: 'topic'
    };
}
