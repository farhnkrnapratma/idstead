<script lang="ts">
    import type { Snippet } from 'svelte';
    import { navigating } from '$app/state';
    import { ArrowUpRight, LoaderCircle, Pin, Sparkles } from '@lucide/svelte';
    import ImageWithSkeleton from '@idstead/ui/components/ImageWithSkeleton.svelte';
    import Tag from '@idstead/ui/components/Tag.svelte';
    import { shortcut } from '@idstead/ui/utils/shortcut.svelte.ts';
    import type { ContentCardImage } from '../contentCards';

    interface Props {
        title: string;
        href: string;
        external?: boolean;
        headingTag?: 'h2' | 'h3' | 'h4';
        shortcutGroup?: string;
        viewTransitionName?: string;
        image?: ContentCardImage | null;
        pinned?: boolean;
        pinnedLabel?: string;
        isNew?: boolean;
        newLabel?: string;
        description?: string | null;
        meta?: Snippet;
        tags?: string[];
        tagItem?: Snippet<[string]>;
        tagHref?: (tag: string) => string;
        tagAriaLabel?: (tag: string) => string;
        leadingTag?: Snippet;
        tagNoun?: string;
        maxTags?: number;
    }

    let {
        title,
        href,
        external = false,
        headingTag = 'h3',
        shortcutGroup,
        viewTransitionName,
        image,
        pinned = false,
        pinnedLabel = 'Pinned',
        isNew = false,
        newLabel = 'New',
        description,
        meta,
        tags = [],
        tagItem,
        tagHref,
        tagAriaLabel,
        leadingTag,
        tagNoun = 'tag',
        maxTags = 5
    }: Props = $props();

    let showAllTags = $state(false);

    const isOpening = $derived(!external && navigating.to?.url.pathname === href);
    const tagLimit = $derived(maxTags - (leadingTag ? 1 : 0));
    const visibleTags = $derived(showAllTags ? tags : tags.slice(0, tagLimit));
    const hiddenTagCount = $derived(tags.length - visibleTags.length);
</script>

{#snippet defaultTag(tag: string)}
    <Tag
        variant="accent"
        href={tagHref?.(tag)}
        aria-label={tagAriaLabel?.(tag)}
        class={tagHref ? 'font-mono hover:bg-accent/15' : 'font-mono'}>{tag}</Tag>
{/snippet}

<div
    class="relative flex h-full flex-col overflow-hidden rounded-md glass-card text-left transition-colors hover:border-accent">
    {#if image}
        <ImageWithSkeleton
            src={image.src}
            sources={image.sources}
            alt={image.alt}
            aspectRatio="aspect-2/1"
            rounded="rounded-none"
            class="w-full shrink-0 border-b border-line-subtle"
            imgClass="object-cover" />
    {/if}
    <div class="flex min-w-0 flex-1 flex-col gap-1.5 p-3 font-sans sm:gap-2 sm:p-4">
        <svelte:element
            this={headingTag}
            style={viewTransitionName ? `view-transition-name: ${viewTransitionName}` : undefined}
            class="type-card-title text-lg">
            <a
                {href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noopener noreferrer' : undefined}
                aria-busy={isOpening}
                use:shortcut={shortcutGroup ?
                    { group: shortcutGroup, label: title }
                :   { disabled: true }}
                class="transition-colors after:absolute after:inset-0 after:rounded-md after:content-[''] hover:text-fg-accent focus-visible:outline-none! focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus-ring">
                {title}{#if external}<span class="sr-only"> (opens in new tab)</span>
                    <ArrowUpRight
                        strokeWidth={1.5}
                        aria-hidden="true"
                        class="ml-0.5 inline size-3.5 align-baseline text-fg-muted" />{/if}
            </a>
            {#if isOpening}
                <LoaderCircle
                    aria-hidden="true"
                    class="inline size-3.5 align-baseline text-fg-muted motion-safe:animate-spin" />
            {/if}
            {#if pinned || isNew}
                <span class="inline-flex items-center gap-1 align-middle select-none">
                    {#if pinned}
                        <span
                            class="inline-flex size-4.5 items-center justify-center rounded-md bg-success-subtle text-fg-success"
                            title={pinnedLabel}
                            role="img"
                            aria-label={pinnedLabel}>
                            <Pin class="size-3 shrink-0" />
                        </span>
                    {/if}
                    {#if isNew}
                        <span
                            class="inline-flex size-4.5 items-center justify-center rounded-md bg-info-subtle text-fg-accent"
                            title={newLabel}
                            role="img"
                            aria-label={newLabel}>
                            <Sparkles class="size-3 shrink-0" />
                        </span>
                    {/if}
                </span>
            {/if}
        </svelte:element>

        {@render meta?.()}

        {#if description}
            <p class="type-body text-fg-secondary">{description}</p>
        {/if}

        {#if leadingTag || tags.length > 0}
            <div class="relative z-20 mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                {@render leadingTag?.()}
                {#each visibleTags as tag (tag)}
                    {@render (tagItem ?? defaultTag)(tag)}
                {/each}
                {#if hiddenTagCount > 0}
                    <Tag
                        variant="subtle"
                        onclick={() => (showAllTags = true)}
                        aria-label="Show {hiddenTagCount} more {hiddenTagCount === 1 ? tagNoun : (
                            `${tagNoun}s`
                        )}"
                        class="font-mono hover:bg-fg-muted/20">
                        +{hiddenTagCount}
                    </Tag>
                {/if}
            </div>
        {/if}
    </div>
</div>
