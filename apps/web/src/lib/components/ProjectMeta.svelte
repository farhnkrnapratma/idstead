<script lang="ts">
    import { GitFork, RotateCcwClock, Scale, Star } from '@lucide/svelte';
    import { pluralize } from '@idstead/domain/pluralize.ts';
    import { formatExactDateTime, formatRelativeTime } from '@idstead/domain/formatters.ts';
    import type { Project } from '@idstead/domain/types.ts';

    let { project }: { project: Project } = $props();

    const updated = $derived(formatRelativeTime(project.pushedAt));
</script>

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
