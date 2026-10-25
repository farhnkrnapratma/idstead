<script lang="ts">
    import type { Snippet } from 'svelte';
    import {
        GitFork,
        Pin,
        RotateCcwClock,
        Scale,
        Sparkles,
        SquareArrowOutUpRight,
        Star
    } from '@lucide/svelte';
    import Tag from '@idstead/ui/components/Tag.svelte';
    import { shortcut } from '@idstead/ui/utils/shortcut.svelte.ts';
    import { pluralize } from '@idstead/domain/pluralize.ts';
    import { formatExactDateTime, formatRelativeTime } from '@idstead/domain/formatters.ts';
    import type { Project } from '@idstead/domain/types.ts';

    const MAX_PILLS = 5;

    interface Props {
        project: Project;
        headingTag?: 'h2' | 'h3' | 'h4';
        pinned?: boolean;
        isNew?: boolean;
        tagItem: Snippet<[string]>;
        languageSelected?: boolean;
        languageHref?: string;
        onLanguageSelect?: (language: string) => void;
    }

    let {
        project,
        headingTag = 'h3',
        pinned = false,
        isNew = false,
        tagItem,
        languageSelected = false,
        languageHref,
        onLanguageSelect
    }: Props = $props();

    let showAllTags = $state(false);

    const updated = $derived(formatRelativeTime(project.pushedAt));
    const language = $derived(project.lang ?? '');
    const tags = $derived(project.tags ?? []);
    const tagLimit = $derived(MAX_PILLS - (language ? 1 : 0));
    const visibleTags = $derived(showAllTags ? tags : tags.slice(0, tagLimit));
    const hiddenTagCount = $derived(tags.length - visibleTags.length);
</script>

<div class="relative flex h-full flex-col rounded-md glass-card border-0! text-left dark:border-0!">
    <div class="flex min-w-0 flex-1 flex-col gap-1.5 p-3 font-sans sm:gap-2 sm:p-4">
        <svelte:element
            this={headingTag}
            class="type-card-title text-lg">
            <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                use:shortcut={{ group: 'projects', label: project.name }}
                class="transition-colors after:absolute after:inset-0 after:rounded-md after:content-[''] hover:text-fg-accent focus-visible:outline-none! focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus-ring">
                {project.name}<span class="sr-only"> (opens in new tab)</span>
                <SquareArrowOutUpRight
                    aria-hidden="true"
                    class="ml-0.5 inline size-3.5 align-baseline text-fg-muted" />
            </a>
            {#if pinned || isNew}
                <span class="inline-flex items-center gap-1 align-middle select-none">
                    {#if pinned}
                        <span
                            class="inline-flex size-4.5 items-center justify-center rounded-full bg-success-subtle text-fg-success"
                            title="Pinned repository"
                            role="img"
                            aria-label="Pinned repository">
                            <Pin class="size-3 shrink-0" />
                        </span>
                    {/if}
                    {#if isNew}
                        <span
                            class="inline-flex size-4.5 items-center justify-center rounded-full bg-info-subtle text-fg-accent"
                            title="New repository"
                            role="img"
                            aria-label="New repository">
                            <Sparkles class="size-3 shrink-0" />
                        </span>
                    {/if}
                </span>
            {/if}
        </svelte:element>

        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-secondary">
            {#if project.stars > 0}
                <span class="inline-flex items-center gap-1 leading-none whitespace-nowrap">
                    <Star
                        aria-hidden="true"
                        class="size-3.5 shrink-0 text-fg-muted"
                        strokeWidth={1.75}
                        absoluteStrokeWidth={true} />
                    <span>{pluralize(project.stars, 'star')}</span>
                </span>
            {/if}
            {#if project.forks > 0}
                <span class="inline-flex items-center gap-1 leading-none whitespace-nowrap">
                    <GitFork
                        aria-hidden="true"
                        class="size-3.5 shrink-0 text-fg-muted"
                        strokeWidth={1.75}
                        absoluteStrokeWidth={true} />
                    <span>{pluralize(project.forks, 'fork')}</span>
                </span>
            {/if}
            {#if updated}
                <span
                    class="inline-flex items-center gap-1 leading-none whitespace-nowrap"
                    title={formatExactDateTime(project.pushedAt)}>
                    <RotateCcwClock
                        aria-hidden="true"
                        class="size-3.5 shrink-0 text-fg-muted"
                        strokeWidth={1.75}
                        absoluteStrokeWidth={true} />
                    <span>Updated {updated}</span>
                </span>
            {/if}
            {#if project.licenseName}
                <span class="inline-flex items-center gap-1 leading-none whitespace-nowrap">
                    <Scale
                        aria-hidden="true"
                        class="size-3.5 shrink-0 text-fg-muted"
                        strokeWidth={1.75}
                        absoluteStrokeWidth={true} />
                    <span>{project.licenseName} License</span>
                </span>
            {/if}
        </div>

        {#if project.desc}
            <p class="type-body text-fg-secondary">{project.desc}</p>
        {/if}

        {#if language || tags.length > 0}
            <div class="relative z-20 mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                {#if language}
                    <Tag
                        variant={languageSelected ? 'tinted-active' : 'tinted'}
                        tint={project.langColor ?? 'var(--color-fg-muted)'}
                        href={onLanguageSelect ? undefined : languageHref}
                        onclick={onLanguageSelect ? () => onLanguageSelect(language) : undefined}
                        aria-pressed={onLanguageSelect ? languageSelected : undefined}
                        aria-label={onLanguageSelect || languageHref ?
                            `Filter by language: ${language}`
                        :   undefined}
                        class={(onLanguageSelect || languageHref) && !languageSelected ?
                            'font-mono hover:bg-(--tag-tint)/20'
                        :   'font-mono'}>
                        {language}
                    </Tag>
                {/if}
                {#each visibleTags as tag (tag)}
                    {@render tagItem(tag)}
                {/each}
                {#if hiddenTagCount > 0}
                    <Tag
                        variant="subtle"
                        onclick={() => (showAllTags = true)}
                        aria-label="Show {hiddenTagCount} more {hiddenTagCount === 1 ? 'topic' : (
                            'topics'
                        )}"
                        class="font-mono hover:bg-fg-muted/20">
                        +{hiddenTagCount}
                    </Tag>
                {/if}
            </div>
        {/if}
    </div>
</div>
