<script lang="ts">
    import {
        CircleCheck,
        CircleDotDashed,
        CalendarCheck2,
        RotateCcwClock,
        BookOpen,
        Eye,
        MessageCircle,
        User
    } from '@lucide/svelte';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import {
        formatCommentCount,
        formatViewCount,
        formatAbsoluteDate,
        formatExactDateTime
    } from '@idstead/domain/formatters.ts';
    import RelativeTime from '@idstead/ui/components/RelativeTime.svelte';
    import SkeletonBlock from '@idstead/ui/components/SkeletonBlock.svelte';
    import type { Snippet } from 'svelte';

    interface Props {
        status?: 'published' | 'draft' | null;
        date?: string | null;
        updatedAt?: string | null;
        readingTime?: string | null;
        views?: number | null;
        commentsCount?: number | null;
        author?: string | null;
        size?: 'xs' | 'xxs';
        layout?: 'stacked' | 'single';
        wrap?: boolean;
        loading?: boolean;
        trailing?: Snippet;
        class?: string;
    }

    let {
        status = null,
        date = '',
        updatedAt = '',
        readingTime = '',
        views,
        commentsCount,
        author = '',
        size = 'xs',
        layout = 'stacked',
        wrap = true,
        loading = false,
        trailing,
        class: className = ''
    }: Props = $props();

    const safeDate = $derived(date || '');
    const safeUpdatedAt = $derived(updatedAt || '');
    const safeReadingTime = $derived(readingTime || '');
    const safeAuthor = $derived(author || '');

    const isUpdatedDifferent = $derived(
        Boolean(
            safeUpdatedAt
            && safeDate
            && new Date(safeUpdatedAt).getTime() - new Date(safeDate).getTime() > 60000
        )
    );

    const publishedTooltip = $derived(
        safeDate ? `Published: ${formatExactDateTime(safeDate)}` : undefined
    );

    const updatedTooltip = $derived(
        safeUpdatedAt ?
            safeDate ?
                `Updated: ${formatExactDateTime(safeUpdatedAt)} (Published: ${formatExactDateTime(safeDate)})`
            :   `Updated: ${formatExactDateTime(safeUpdatedAt)}`
        :   undefined
    );

    const primaryParts = $derived(
        (
            [
                status ? 'status' : null,
                safeAuthor ? 'author' : null,
                isUpdatedDifferent ? 'updatedAt'
                : safeDate ? 'date'
                : safeUpdatedAt ? 'updatedAt'
                : null
            ] as const
        ).filter((p): p is NonNullable<typeof p> => p !== null)
    );

    const secondaryParts = $derived(
        (
            [
                safeReadingTime ? 'readingTime' : null,
                views !== undefined && views !== null ? 'views' : null,
                commentsCount !== undefined && commentsCount !== null ? 'comments' : null
            ] as const
        ).filter((p): p is NonNullable<typeof p> => p !== null)
    );

    const allParts = $derived([...primaryParts, ...secondaryParts]);

    const textClass = $derived(size === 'xxs' ? 'text-2xs' : 'text-xs');
    const iconClass = $derived(
        size === 'xxs' ?
            'size-3 shrink-0 text-fg-muted transition-colors'
        :   'size-3.5 shrink-0 text-fg-muted transition-colors'
    );
</script>

{#snippet renderPart(
    part: 'status' | 'author' | 'date' | 'updatedAt' | 'readingTime' | 'views' | 'comments'
)}
    {#if part === 'status'}
        {#if status === 'published'}
            <span
                title="Published"
                aria-label="Published"
                class="inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-success-subtle/80 p-1 text-2xs leading-none font-medium whitespace-nowrap text-success sm:px-2 sm:py-0.5">
                <CircleCheck
                    class="size-3 shrink-0 text-success"
                    strokeWidth={1.75}
                    absoluteStrokeWidth={true} />
                <span class="hidden leading-none sm:inline">Published</span>
            </span>
        {:else}
            <span
                title="Draft"
                aria-label="Draft"
                class="inline-flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning-subtle/80 p-1 text-2xs leading-none font-medium whitespace-nowrap text-fg-warning sm:px-2 sm:py-0.5">
                <CircleDotDashed
                    class="size-3 shrink-0 text-fg-warning"
                    strokeWidth={1.75}
                    absoluteStrokeWidth={true} />
                <span class="hidden leading-none sm:inline">Draft</span>
            </span>
        {/if}
    {:else if part === 'author'}
        <span
            class="hidden items-center gap-1 leading-none font-normal whitespace-nowrap text-fg-secondary sm:inline-flex">
            <User
                class={iconClass}
                strokeWidth={1.75}
                absoluteStrokeWidth={true} />
            <span>{safeAuthor}</span>
        </span>
    {:else if part === 'date'}
        <span
            title={publishedTooltip}
            class="inline-flex items-center gap-1 leading-none font-normal whitespace-nowrap text-fg-secondary">
            <CalendarCheck2
                class={iconClass}
                strokeWidth={1.75}
                absoluteStrokeWidth={true} />
            <time
                datetime={safeDate}
                class="sm:hidden">{formatAbsoluteDate(safeDate, 'short')}</time>
            <RelativeTime
                date={safeDate}
                tag="time"
                class="hidden sm:inline" />
        </span>
    {:else if part === 'updatedAt'}
        <span
            title={updatedTooltip}
            class="inline-flex items-center gap-1 leading-none font-normal whitespace-nowrap text-fg-secondary">
            <RotateCcwClock
                class={iconClass}
                strokeWidth={1.75}
                absoluteStrokeWidth={true} />
            <time
                datetime={safeUpdatedAt}
                class="sm:hidden">{formatAbsoluteDate(safeUpdatedAt, 'short')}</time>
            <span class="hidden sm:inline"
                >Updated <RelativeTime
                    date={safeUpdatedAt}
                    tag="time" /></span>
        </span>
    {:else if part === 'readingTime'}
        <span
            class="inline-flex items-center gap-1 leading-none font-normal whitespace-nowrap text-fg-secondary">
            <BookOpen
                class={iconClass}
                strokeWidth={1.75}
                absoluteStrokeWidth={true} />
            <span>{safeReadingTime}</span>
        </span>
    {:else if part === 'views'}
        <span
            class="hidden items-center gap-1 leading-none font-normal whitespace-nowrap text-fg-secondary sm:inline-flex">
            <Eye
                class={iconClass}
                strokeWidth={1.75}
                absoluteStrokeWidth={true} />
            <span>{formatViewCount(views)}</span>
        </span>
    {:else if part === 'comments'}
        <span
            class="hidden items-center gap-1 leading-none font-normal whitespace-nowrap text-fg-secondary sm:inline-flex">
            <MessageCircle
                class={iconClass}
                strokeWidth={1.75}
                absoluteStrokeWidth={true} />
            <span>{formatCommentCount(commentsCount)}</span>
        </span>
    {/if}
{/snippet}

{#if loading}
    <div class={cn('flex items-center gap-x-3.5 select-none', textClass, className)}>
        <span class="inline-flex items-center gap-1">
            <CalendarCheck2
                class={iconClass}
                strokeWidth={1.75}
                absoluteStrokeWidth={true} />
            <SkeletonBlock
                height="h-3"
                width="w-14" />
        </span>
        <span class="inline-flex items-center gap-1">
            <BookOpen
                class={iconClass}
                strokeWidth={1.75}
                absoluteStrokeWidth={true} />
            <SkeletonBlock
                height="h-3"
                width="w-12" />
        </span>
        <span class="hidden items-center gap-1 sm:inline-flex">
            <Eye
                class={iconClass}
                strokeWidth={1.75}
                absoluteStrokeWidth={true} />
            <SkeletonBlock
                height="h-3"
                width="w-8" />
        </span>
        <span class="inline-flex items-center gap-1">
            <MessageCircle
                class={iconClass}
                strokeWidth={1.75}
                absoluteStrokeWidth={true} />
            <SkeletonBlock
                height="h-3"
                width="w-16" />
        </span>
        {@render trailing?.()}
    </div>
{:else if layout === 'single'}
    <div
        class={cn(
            'flex items-center gap-x-3.5 select-none',
            wrap ? 'flex-wrap gap-y-1' : (
                'scrollbar-none overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
            ),
            textClass,
            className
        )}>
        {#each allParts as part (part)}
            {@render renderPart(part)}
        {/each}
        {@render trailing?.()}
    </div>
{:else}
    <div class={cn('flex flex-col gap-1 select-none', textClass, className)}>
        {#if primaryParts.length > 0}
            <div
                class={cn(
                    'flex items-center gap-x-3.5',
                    wrap ? 'flex-wrap gap-y-1' : (
                        'scrollbar-none overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
                    )
                )}>
                {#each primaryParts as part (part)}
                    {@render renderPart(part)}
                {/each}
            </div>
        {/if}

        {#if secondaryParts.length > 0}
            <div
                class={cn(
                    'flex items-center gap-x-3.5',
                    wrap ? 'flex-wrap gap-y-1' : (
                        'scrollbar-none overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
                    )
                )}>
                {#each secondaryParts as part (part)}
                    {@render renderPart(part)}
                {/each}
            </div>
        {/if}
    </div>
{/if}
