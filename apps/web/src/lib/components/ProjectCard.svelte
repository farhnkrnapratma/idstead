<script lang="ts">
    import type { Snippet } from 'svelte';
    import {
        FolderArchive,
        GitFork,
        Pin,
        RotateCcwClock,
        Scale,
        Sparkles,
        SquareArrowOutUpRight,
        Star
    } from '@lucide/svelte';
    import Button from '@idstead/ui/components/Button.svelte';
    import ImageWithSkeleton from '@idstead/ui/components/ImageWithSkeleton.svelte';
    import Tag from '@idstead/ui/components/Tag.svelte';
    import { pluralize } from '@idstead/domain/pluralize.ts';
    import type { Project } from '@idstead/domain/types.ts';

    interface Props {
        project: Project;
        headingTag?: 'h2' | 'h3' | 'h4';
        pinned?: boolean;
        isNew?: boolean;
        tagItem: Snippet<[string]>;
        languageSelected?: boolean;
        onLanguageSelect?: (language: string) => void;
    }

    let {
        project,
        headingTag = 'h3',
        pinned = false,
        isNew = false,
        tagItem,
        languageSelected = false,
        onLanguageSelect
    }: Props = $props();

    const language = $derived(project.lang ?? '');

    let bannerFailed = $state(false);
    const repoBannerUrl = $derived(
        project.openGraphImageUrl || `https://opengraph.githubassets.com/1/${project.fullName}`
    );
</script>

<div class="relative flex flex-col rounded-md glass-card border-0! text-left dark:border-0!">
    <div class="relative aspect-2/1 w-full shrink-0 overflow-hidden rounded-t-md">
        {#if !bannerFailed}
            <ImageWithSkeleton
                src={repoBannerUrl}
                alt={`Banner image for project “${project.name}”`}
                rounded=""
                onerror={() => (bannerFailed = true)}
                class="h-full w-full object-cover" />
        {:else}
            <div
                class="relative flex h-full w-full items-center justify-center overflow-hidden bg-linear-to-br from-accent/15 to-accent/5 select-none">
                <FolderArchive class="size-10 text-accent/50" />
            </div>
        {/if}
    </div>

    <div class="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3 font-sans sm:gap-2.5 sm:p-4">
        <div class="flex flex-col gap-1.5 sm:gap-2">
            <div>
                <svelte:element
                    this={headingTag}
                    class="type-card-title">
                    {project.name}
                    {#if pinned || isNew}
                        <span class="inline-flex items-center gap-1 align-middle select-none">
                            {#if pinned}
                                <span
                                    class="inline-flex size-4.5 items-center justify-center rounded-full bg-success-subtle text-success"
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
            </div>

            <div class="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs">
                <span
                    class="inline-flex items-center gap-1.5 leading-none font-normal whitespace-nowrap text-fg-secondary">
                    <Star
                        class="size-3.5 shrink-0 text-fg-muted/70 transition-colors"
                        strokeWidth={1.75}
                        absoluteStrokeWidth={true} />
                    <span>{pluralize(project.stars, 'star')}</span>
                </span>
                <span
                    class="hidden items-center gap-1.5 leading-none font-normal whitespace-nowrap text-fg-secondary sm:inline-flex">
                    <GitFork
                        class="size-3.5 shrink-0 text-fg-muted/70 transition-colors"
                        strokeWidth={1.75}
                        absoluteStrokeWidth={true} />
                    <span>{pluralize(project.forks, 'fork')}</span>
                </span>
                <span
                    class="hidden items-center gap-1.5 leading-none font-normal whitespace-nowrap text-fg-secondary sm:inline-flex">
                    <RotateCcwClock
                        class="size-3.5 shrink-0 text-fg-muted/70 transition-colors"
                        strokeWidth={1.75}
                        absoluteStrokeWidth={true} />
                    <span>{pluralize(project.commits, 'commit')}</span>
                </span>
                {#if project.licenseName}
                    <span
                        class="inline-flex items-center gap-1.5 leading-none font-normal whitespace-nowrap text-fg-secondary">
                        <Scale
                            class="size-3.5 shrink-0 text-fg-muted/70 transition-colors"
                            strokeWidth={1.75}
                            absoluteStrokeWidth={true} />
                        <span>{project.licenseName} License</span>
                    </span>
                {/if}
            </div>

            {#if project.desc}
                <p class="type-body text-fg-secondary">{project.desc}</p>
            {/if}

            {#if language || (project.tags && project.tags.length > 0)}
                <div class="relative z-20 flex flex-wrap items-center gap-1.5 pt-0.5">
                    {#if language}
                        <Tag
                            variant={languageSelected ? 'tinted-active' : 'tinted'}
                            tint={project.langColor ?? 'var(--color-fg-muted)'}
                            onclick={onLanguageSelect ?
                                () => onLanguageSelect(language)
                            :   undefined}
                            aria-pressed={onLanguageSelect ? languageSelected : undefined}
                            aria-label={onLanguageSelect ?
                                `Filter by language: ${language}`
                            :   undefined}
                            class={onLanguageSelect && !languageSelected ?
                                'font-mono hover:bg-(--tag-tint)/20'
                            :   'font-mono'}>
                            {language}
                        </Tag>
                    {/if}
                    {#each project.tags ?? [] as tag (tag)}
                        {@render tagItem(tag)}
                    {/each}
                </div>
            {/if}
        </div>

        <div class="relative z-20 mt-auto flex flex-col gap-2 pt-1">
            <hr class="border-line-subtle/25" />
            <Button
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                type="primary"
                size="sm"
                shortcutGroup="projects"
                shortcutLabel={project.name}
                fullWidth>
                {#snippet leading()}
                    <SquareArrowOutUpRight class="size-3.5" />
                {/snippet}
                View on GitHub
            </Button>
        </div>
    </div>
</div>
