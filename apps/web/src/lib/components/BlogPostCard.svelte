<script
    lang="ts"
    module>
    export interface BlogPostCardData {
        slug: string;
        title: string;
        excerpt?: string | null;
        bannerPublicUrl?: string | null;
        pinned?: boolean;
        created_at: string;
        updated_at?: string | null;
        read_time?: string;
        comment_count?: number;
        views_count?: number;
        tags?: string[];
    }
</script>

<script lang="ts">
    import type { Snippet } from 'svelte';
    import { navigating } from '$app/state';
    import { Image as ImageIcon, Pin, Sparkles } from '@lucide/svelte';
    import Button from '@idstead/ui/components/Button.svelte';
    import ImageWithSkeleton from '@idstead/ui/components/ImageWithSkeleton.svelte';
    import Tag from '@idstead/ui/components/Tag.svelte';
    import ArticleMeta from '#lib/article/ArticleMeta.svelte';
    import { avifSources, blogBannerAlt } from '#lib/blogBanner.ts';
    import { formatReadTime } from '@idstead/domain/formatters.ts';
    import { decodeHtmlEntities } from '@mdrs/core';

    const NEW_POST_WINDOW_MS = 24 * 60 * 60 * 1000;

    let {
        post,
        headingTag = 'h3',
        tagItem
    }: {
        post: BlogPostCardData;
        headingTag?: 'h2' | 'h3' | 'h4';
        tagItem?: Snippet<[string]>;
    } = $props();

    let bannerFailed = $state(false);

    const postPath = $derived(`/blog/${post.slug}`);
    const isOpening = $derived(navigating.to?.url.pathname === postPath);

    const isNew = $derived(
        !!post.created_at && Date.now() - new Date(post.created_at).getTime() < NEW_POST_WINDOW_MS
    );
</script>

{#snippet staticTag(tag: string)}
    <Tag
        variant="accent"
        class="font-mono">{decodeHtmlEntities(tag)}</Tag>
{/snippet}

<div class="relative flex h-full flex-col rounded-md glass-card border-0! text-left dark:border-0!">
    <div class="relative aspect-2/1 w-full shrink-0 overflow-hidden rounded-t-md">
        {#if post.bannerPublicUrl && !bannerFailed}
            <ImageWithSkeleton
                src={post.bannerPublicUrl}
                sources={avifSources(post.bannerPublicUrl)}
                alt={blogBannerAlt(post.title, post.excerpt)}
                rounded=""
                onerror={() => (bannerFailed = true)}
                class="h-full w-full object-cover" />
        {:else}
            <div
                class="relative flex h-full w-full items-center justify-center overflow-hidden bg-linear-to-br from-accent/15 to-accent/5 select-none">
                <ImageIcon class="size-10 text-fg-muted" />
            </div>
        {/if}
    </div>

    <div class="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3 font-sans sm:gap-2.5 sm:p-4">
        <div class="flex flex-col gap-1.5 sm:gap-2">
            <div>
                <svelte:element
                    this={headingTag}
                    style="view-transition-name: post-title-{post.slug}"
                    class="type-card-title">
                    {post.title}
                    {#if post.pinned || isNew}
                        <span class="inline-flex items-center gap-1 align-middle select-none">
                            {#if post.pinned}
                                <span
                                    class="inline-flex size-4.5 items-center justify-center rounded-full bg-success-subtle text-success"
                                    title="Pinned post"
                                    role="img"
                                    aria-label="Pinned post">
                                    <Pin class="size-3 shrink-0" />
                                </span>
                            {/if}
                            {#if isNew}
                                <span
                                    class="inline-flex size-4.5 items-center justify-center rounded-full bg-info-subtle text-fg-accent"
                                    title="New post"
                                    role="img"
                                    aria-label="New post">
                                    <Sparkles class="size-3 shrink-0" />
                                </span>
                            {/if}
                        </span>
                    {/if}
                </svelte:element>
            </div>

            <ArticleMeta
                size="xs"
                layout="single"
                class="min-h-4.5"
                date={post.created_at}
                updatedAt={post.updated_at}
                readingTime={formatReadTime(post.read_time)}
                commentsCount={post.comment_count}
                views={post.views_count} />

            {#if post.excerpt}
                <p class="type-body text-fg-secondary">{post.excerpt}</p>
            {/if}

            {#if post.tags && post.tags.length > 0}
                <div class="relative z-20 flex flex-wrap items-center gap-1.5 pt-0.5">
                    {#each post.tags as tag (tag)}
                        {@render (tagItem ?? staticTag)(tag)}
                    {/each}
                </div>
            {/if}
        </div>

        <div class="relative z-20 mt-auto flex flex-col gap-2 pt-1">
            <hr class="border-line-subtle/25" />
            <Button
                href={postPath}
                isLoading={isOpening}
                type="primary"
                size="sm"
                shortcutGroup="posts"
                shortcutLabel={post.title}
                fullWidth>
                Read post
            </Button>
        </div>
    </div>
</div>
