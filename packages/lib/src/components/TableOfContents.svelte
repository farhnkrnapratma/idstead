<script lang="ts">
    import { pushState } from '$app/navigation';
    import { sanitizeHtml } from '#lib/sanitizeHtml.ts';
    import { onMount } from 'svelte';
    import {
        TableOfContents as TableOfContentsIcon,
        ChevronsUpDown,
        ChevronsDownUp
    } from '@lucide/svelte';
    import { cn } from '../utils/cn';

    interface HeadingItem {
        id: string;
        text: string;
        level: number;
    }

    interface Props {
        headings: HeadingItem[];
        title?: string;
        collapsible?: boolean;
        defaultCollapsed?: boolean;
        class?: string;
        scrollLinkedEl?: HTMLElement | null;
    }

    let {
        headings = [],
        title = 'Table of contents',
        collapsible = false,
        defaultCollapsed = false,
        class: className = '',
        scrollLinkedEl = null
    }: Props = $props();

    let activeHeadingId = $state('');
    let indicatorTop = $state(0);
    let indicatorHeight = $state(0);
    let isIndicatorVisible = $state(false);
    let tocListEl = $state<HTMLUListElement | null>(null);
    let scrollContainerEl = $state<HTMLDivElement | null>(null);

    const minLevel = $derived(headings.length > 0 ? Math.min(...headings.map(h => h.level)) : 2);

    let isPinnedByClick = false;
    let unpinTimeout: ReturnType<typeof setTimeout> | undefined;

    function unpinAfterSettle() {
        if (unpinTimeout) clearTimeout(unpinTimeout);
        window.removeEventListener('scrollend', unpinAfterSettle);
        isPinnedByClick = false;
    }

    function pinActiveHeading() {
        isPinnedByClick = true;
        if (unpinTimeout) clearTimeout(unpinTimeout);
        window.addEventListener('scrollend', unpinAfterSettle, { once: true });
        unpinTimeout = setTimeout(unpinAfterSettle, 1500);
    }

    function navigateToHeading(id: string, instant = false) {
        const target = document.getElementById(id);
        if (!target) return;

        pinActiveHeading();

        target.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'start' });

        pushState(`#${id}`, {});
        activeHeadingId = id;
        updateIndicatorPos(id, undefined, undefined, true);
    }

    function updateIndicatorPos(
        id: string,
        forcedTop?: number,
        forcedHeight?: number,
        smooth = false
    ) {
        if (!tocListEl) return;

        const activeEl = tocListEl.querySelector(`[href="#${id}"]`) as HTMLElement;

        if (activeEl) {
            const top = forcedTop !== undefined ? forcedTop : activeEl.offsetTop;

            const height = forcedHeight !== undefined ? forcedHeight : activeEl.offsetHeight;

            indicatorTop = top;
            indicatorHeight = height;
            isIndicatorVisible = true;

            if (scrollContainerEl && !isPinnedByClick) {
                const cTop = scrollContainerEl.scrollTop;
                const cHeight = scrollContainerEl.clientHeight;

                if (top < cTop + 16 || top + height > cTop + cHeight - 16) {
                    scrollContainerEl.scrollTo({
                        top: Math.max(0, top - cHeight / 2 + height / 2),
                        behavior: smooth ? 'smooth' : 'instant'
                    });
                }
            }
        }
    }

    onMount(() => {
        if (headings.length === 0) return;

        let rafId: number | null = null;

        const updateScrollspyPosition = () => {
            if (isPinnedByClick) return;
            if (!tocListEl || headings.length === 0) return;

            const tocLinks = headings
                .map(h => {
                    const link = tocListEl?.querySelector(`[href="#${h.id}"]`) as HTMLElement;

                    return link ?
                            { id: h.id, top: link.offsetTop, height: link.offsetHeight }
                        :   null;
                })
                .filter((l): l is { id: string; top: number; height: number } => l !== null);

            if (tocLinks.length === 0) return;

            const viewportOffset = 180;

            const headingPositions = headings
                .map(h => {
                    const el = document.getElementById(h.id);

                    return el ? { id: h.id, top: el.getBoundingClientRect().top } : null;
                })
                .filter((h): h is { id: string; top: number } => h !== null);

            if (headingPositions.length === 0) return;

            let currentIndex = -1;

            for (let i = 0; i < headingPositions.length; i++) {
                if (headingPositions[i].top <= viewportOffset) {
                    currentIndex = i;
                } else {
                    break;
                }
            }

            if (currentIndex === -1) {
                activeHeadingId = '';
                isIndicatorVisible = false;
                return;
            }

            const hCurrent = headingPositions[currentIndex];
            const lCurrent = tocLinks.find(l => l.id === hCurrent.id);

            if (!lCurrent) return;

            activeHeadingId = hCurrent.id;

            updateIndicatorPos(hCurrent.id, lCurrent.top, lCurrent.height);
        };

        const handleScroll = () => {
            if (rafId !== null) return;

            rafId = requestAnimationFrame(() => {
                rafId = null;
                updateScrollspyPosition();
            });
        };

        window.addEventListener('scroll', handleScroll, { passive: true });

        document.addEventListener('scroll', handleScroll, { capture: true, passive: true });

        const forwardWheelToArticle = (event: WheelEvent) => {
            if (!scrollLinkedEl) return;

            event.preventDefault();
            scrollLinkedEl.scrollTop += event.deltaY;
        };

        scrollContainerEl?.addEventListener('wheel', forwardWheelToArticle, { passive: false });

        updateScrollspyPosition();

        return () => {
            window.removeEventListener('scroll', handleScroll);

            document.removeEventListener('scroll', handleScroll, { capture: true });

            scrollContainerEl?.removeEventListener('wheel', forwardWheelToArticle);

            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
        };
    });

    function formatHeadingText(text: string): string {
        if (!text) return '';

        let result = text;

        result = result.replace(
            /`([^`]+)`/g,
            '<code class="rounded bg-surface-hover/80 px-1 py-0.5 font-mono text-[0.85em] font-normal text-text-primary">$1</code>'
        );

        result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        return sanitizeHtml(result);
    }
</script>

{#snippet tocList()}
    <div
        bind:this={scrollContainerEl}
        class="relative -mx-2 min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <ul
            id="toc-list"
            bind:this={tocListEl}
            class="relative flex min-h-full flex-col pl-3"
            role="list">
            <div
                class="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-0 border-l border-border-tree transition-none"
                aria-hidden="true">
            </div>

            {#if isIndicatorVisible}
                <div
                    class="pointer-events-none absolute top-(--indicator-top) left-0 z-20 h-(--indicator-height) w-0 border-l border-accent transition-none"
                    style="--indicator-top: {indicatorTop}px; --indicator-height: {indicatorHeight}px;"
                    aria-hidden="true">
                </div>
            {/if}

            {#each headings as heading, index (heading.id + '-' + index)}
                {@const isActive = activeHeadingId === heading.id}
                {@const depth = Math.max(0, heading.level - minLevel)}
                {@const isSub = depth > 0}
                {@const branchWidth = isSub ? 16 + (depth - 1) * 12 : 0}

                <li class="text-xs">
                    <a
                        href="#{heading.id}"
                        onclick={e => {
                            e.preventDefault();
                            navigateToHeading(heading.id);
                        }}
                        aria-current={isActive ? 'true' : undefined}
                        class="relative -ml-3 flex items-center rounded-r-xs py-1.5 pr-2 leading-4 transition-colors duration-150 ease-in-out hover:text-accent-text {(
                            isSub
                        ) ?
                            'font-normal'
                        :   'font-medium'} {isActive ? 'bg-accent/10 text-accent-text'
                        : isSub ? 'text-text-secondary hover:bg-surface-hover/30'
                        : 'text-text-primary hover:bg-surface-hover/30'}"
                        style="padding-left: {isSub ? `${branchWidth + 8}px` : '10px'};">
                        {#if isSub}
                            <span
                                class="pointer-events-none absolute top-1/2 left-0 h-0 border-t transition-none select-none {(
                                    isActive
                                ) ?
                                    'border-accent'
                                :   'border-border-tree'}"
                                style:width="{branchWidth}px"
                                aria-hidden="true"></span>
                        {/if}

                        <span class="min-w-0 grow">
                            {@html formatHeadingText(heading.text)}
                        </span>
                    </a>
                </li>
            {/each}
        </ul>
    </div>
{/snippet}

{#if headings.length > 0}
    {#if collapsible}
        <details
            class={cn(
                'group markdown-details my-0 overflow-hidden rounded-md glass-card border border-border-subtle/60 text-text-primary shadow-md backdrop-blur-md select-none',
                className
            )}
            open={!defaultCollapsed}>
            <summary
                class="markdown-details-summary flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 border-b border-transparent px-3.5 py-1.5 text-sm font-medium text-text-primary transition-colors select-none group-open:border-border-subtle hover:bg-surface-hover/50 dark:group-open:border-white/10 [&::-webkit-details-marker]:hidden">
                <span class="inline-flex items-center gap-2">
                    <TableOfContentsIcon class="size-4 shrink-0 text-text-primary" />

                    <span
                        class="markdown-details-title translate-y-px text-sm leading-none font-medium text-text-primary">
                        {title}
                    </span>
                </span>

                <span
                    class="markdown-details-icon inline-flex shrink-0 items-center justify-center text-text-muted"
                    aria-hidden="true">
                    <ChevronsUpDown class="size-3.5 group-open:hidden" />

                    <ChevronsDownUp class="hidden size-3.5 group-open:block" />
                </span>
            </summary>

            <div
                class="markdown-details-body px-3.5 py-3 text-sm leading-relaxed font-normal text-text-secondary">
                {@render tocList()}
            </div>
        </details>
    {:else}
        <nav
            aria-label="Table of contents"
            class={cn('flex flex-col rounded-md glass-card p-4 select-none', className)}>
            <div class="mb-2 shrink-0 text-sm font-normal text-text-primary select-none">
                {title}
            </div>

            {@render tocList()}
        </nav>
    {/if}
{/if}

<style>
    @reference "../global.css";

    :global(nav[aria-label='Table of contents'] code),
    :global(details.markdown-details code) {
        @apply rounded-md bg-code-inline-bg px-1.5 py-0.5 font-mono text-[0.85em] font-normal text-inherit;
    }

    :global(nav[aria-label='Table of contents'] kbd),
    :global(details.markdown-details kbd) {
        @apply rounded-md border border-border-subtle bg-surface-card px-1 py-0.5 font-mono text-[0.75em];
    }
</style>
