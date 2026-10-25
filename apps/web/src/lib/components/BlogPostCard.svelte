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
    import { Image as ImageIcon, LoaderCircle, Pin, Sparkles } from '@lucide/svelte';
    import ImageWithSkeleton from '@idstead/ui/components/ImageWithSkeleton.svelte';
    import Tag from '@idstead/ui/components/Tag.svelte';
    import { shortcut } from '@idstead/ui/utils/shortcut.svelte.ts';
    import ArticleMeta from '#lib/article/ArticleMeta.svelte';
    import { avifSources } from '#lib/blogBanner.ts';
    import { formatReadTime } from '@idstead/domain/formatters.ts';
    import { decodeHtmlEntities } from '@mdrs/core';

    const NEW_POST_WINDOW_MS = 24 * 60 * 60 * 1000;
    const MAX_PILLS = 5;

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
    let showAllTags = $state(false);

    const postPath = $derived(`/blog/${post.slug}`);
    const isOpening = $derived(navigating.to?.url.pathname === postPath);
    const tags = $derived(post.tags ?? []);
    const visibleTags = $derived(showAllTags ? tags : tags.slice(0, MAX_PILLS));
    const hiddenTagCount = $derived(tags.length - visibleTags.length);

    const isNew = $derived(
        !!post.created_at && Date.now() - new Date(post.created_at).getTime() < NEW_POST_WINDOW_MS
    );
</script>

{#snippet linkedTag(tag: string)}
    <Tag
        variant="accent"
        href="/blog?tag={encodeURIComponent(tag)}"
        aria-label="Show posts tagged {decodeHtmlEntities(tag)}"
        class="font-mono hover:bg-accent/15">{decodeHtmlEntities(tag)}</Tag>
{/snippet}

<div
    class="relative flex h-full flex-col rounded-md glass-card border-0! text-left sm:grid sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] dark:border-0!">
    <div
        class="relative aspect-2/1 w-full shrink-0 overflow-hidden rounded-t-md sm:m-4 sm:mr-0 sm:w-auto sm:self-start sm:rounded-sm">
        {#if post.bannerPublicUrl && !bannerFailed}
            <ImageWithSkeleton
                src={post.bannerPublicUrl}
                sources={avifSources(post.bannerPublicUrl)}
                alt=""
                rounded=""
                onerror={() => (bannerFailed = true)}
                class="h-full w-full object-cover" />
        {:else}
            <div
                class="relative flex h-full w-full items-center justify-center overflow-hidden bg-linear-to-br from-accent/15 to-accent/5 select-none">
                <ImageIcon class="size-8 text-fg-muted" />
            </div>
        {/if}
    </div>

    <div class="flex min-w-0 flex-1 flex-col gap-1.5 p-3 font-sans sm:gap-2 sm:p-4">
        <svelte:element
            this={headingTag}
            style="view-transition-name: post-title-{post.slug}"
            class="type-card-title text-lg">
            <a
                href={postPath}
                aria-busy={isOpening}
                use:shortcut={{ group: 'posts', label: post.title }}
                class="transition-colors after:absolute after:inset-0 after:rounded-md after:content-[''] hover:text-fg-accent focus-visible:outline-none! focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus-ring">
                {post.title}
            </a>
            {#if isOpening}
                <LoaderCircle
                    aria-hidden="true"
                    class="inline size-3.5 align-baseline text-fg-muted motion-safe:animate-spin" />
            {/if}
            {#if post.pinned || isNew}
                <span class="inline-flex items-center gap-1 align-middle select-none">
                    {#if post.pinned}
                        <span
                            class="inline-flex size-4.5 items-center justify-center rounded-full bg-success-subtle text-fg-success"
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

        {#if tags.length > 0}
            <div class="relative z-20 mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                {#each visibleTags as tag (tag)}
                    {@render (tagItem ?? linkedTag)(tag)}
                {/each}
                {#if hiddenTagCount > 0}
                    <Tag
                        variant="subtle"
                        onclick={() => (showAllTags = true)}
                        aria-label="Show {hiddenTagCount} more {hiddenTagCount === 1 ? 'tag' : (
                            'tags'
                        )}"
                        class="font-mono hover:bg-fg-muted/20">
                        +{hiddenTagCount}
                    </Tag>
                {/if}
            </div>
        {/if}
    </div>
</div>
