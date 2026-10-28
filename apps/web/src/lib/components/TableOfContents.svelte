<script lang="ts">
    import { goto } from '$app/navigation';
    import MdrsHtml from '@mdrs/dom/MdrsHtml.svelte';
    import { elementRef } from '@idstead/ui/utils/elementRef.ts';
    import { onMount } from 'svelte';
    import {
        TableOfContents as TableOfContentsIcon,
        ChevronsUpDown,
        ChevronsDownUp
    } from '@lucide/svelte';
    import { cn } from '@idstead/ui/utils/cn.ts';
    import { proportionalScrollTop } from './tocScroll.ts';
    import { tocRail, type RailItem } from './tocRail.ts';

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
    let tocListEl = $state<HTMLUListElement | null>(null);
    let scrollContainerEl = $state<HTMLDivElement | null>(null);
    let railItems = $state<RailItem[]>([]);

    const minLevel = $derived(headings.length > 0 ? Math.min(...headings.map(h => h.level)) : 2);
    const depths = $derived(headings.map(h => Math.max(0, h.level - minLevel)));
    const rail = $derived(tocRail(railItems));
    const activeIndex = $derived(headings.findIndex(h => h.id === activeHeadingId));
    const activeSegment = $derived(activeIndex >= 0 ? rail.segments[activeIndex] : undefined);

    function measureRail(list: HTMLUListElement) {
        const levels = depths;
        const measure = () => {
            railItems = [...list.querySelectorAll<HTMLElement>('a[data-toc-link]')].map(
                (link, index) => ({
                    top: link.offsetTop,
                    height: link.offsetHeight,
                    depth: levels[index] ?? 0
                })
            );
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(list);
        return () => observer.disconnect();
    }

    let isPinnedByClick = false;
    let isTocDrivenByUser = false;
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

        void goto(`#${id}`, { shallow: true });
        activeHeadingId = id;
        revealActiveLink(id, undefined, undefined, true);
    }

    function revealActiveLink(
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

            if (scrollContainerEl && !isPinnedByClick && !isTocDrivenByUser) {
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
                return;
            }

            const hCurrent = headingPositions[currentIndex];
            const lCurrent = tocLinks.find(l => l.id === hCurrent.id);

            if (!lCurrent) return;

            activeHeadingId = hCurrent.id;

            revealActiveLink(hCurrent.id, lCurrent.top, lCurrent.height);
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

        const startTocDrag = () => {
            isTocDrivenByUser = true;
        };
        const endTocDrag = () => {
            isTocDrivenByUser = false;
        };
        const followTocWithArticle = () => {
            if (!isTocDrivenByUser || !scrollContainerEl || !scrollLinkedEl) return;
            scrollLinkedEl.scrollTop = proportionalScrollTop(scrollContainerEl, scrollLinkedEl);
        };

        scrollContainerEl?.addEventListener('pointerdown', startTocDrag);
        scrollContainerEl?.addEventListener('touchstart', startTocDrag, { passive: true });
        scrollContainerEl?.addEventListener('scroll', followTocWithArticle, { passive: true });
        window.addEventListener('pointerup', endTocDrag);
        window.addEventListener('pointercancel', endTocDrag);
        window.addEventListener('touchend', endTocDrag);

        updateScrollspyPosition();

        return () => {
            window.removeEventListener('scroll', handleScroll);

            document.removeEventListener('scroll', handleScroll, { capture: true });

            scrollContainerEl?.removeEventListener('wheel', forwardWheelToArticle);
            scrollContainerEl?.removeEventListener('pointerdown', startTocDrag);
            scrollContainerEl?.removeEventListener('touchstart', startTocDrag);
            scrollContainerEl?.removeEventListener('scroll', followTocWithArticle);
            window.removeEventListener('pointerup', endTocDrag);
            window.removeEventListener('pointercancel', endTocDrag);
            window.removeEventListener('touchend', endTocDrag);

            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
        };
    });

    function formatHeadingText(text: string): string {
        if (!text) return '';

        let result = text;

        result = result.replace(/`([^`]+)`/g, '<code>$1</code>');

        result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        return result;
    }
</script>

{#snippet tocList()}
    <div
        {@attach elementRef<HTMLDivElement>(node => (scrollContainerEl = node))}
        class="relative -mx-2 min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <ul
            id="toc-list"
            {@attach elementRef<HTMLUListElement>(node => (tocListEl = node))}
            {@attach measureRail}
            class="relative m-0 flex list-none flex-col p-0"
            role="list">
            <svg
                aria-hidden="true"
                class="pointer-events-none absolute inset-0 size-full overflow-visible"
                fill="none">
                <path
                    d={rail.d}
                    stroke-width="2"
                    stroke-linecap="round"
                    class={cn(
                        'stroke-fg-accent transition-[stroke-dasharray,stroke-dashoffset,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-opacity',
                        activeSegment ? 'opacity-100' : 'opacity-0'
                    )}
                    style:stroke-dasharray={activeSegment ?
                        `${activeSegment.length} ${rail.total}`
                    :   undefined}
                    style:stroke-dashoffset={activeSegment ? -activeSegment.start : undefined} />
            </svg>

            {#each headings as heading, index (heading.id + '-' + index)}
                {@const isActive = activeHeadingId === heading.id}
                {@const depth = depths[index] ?? 0}
                {@const previousDepth = index > 0 ? (depths[index - 1] ?? 0) : depth}

                <li>
                    {#if depth !== previousDepth}
                        <svg
                            aria-hidden="true"
                            class="block h-2 text-line-subtle"
                            style:margin-left="calc({Math.min(depth, previousDepth)}rem - 0.0625rem)"
                            style:width="{Math.abs(depth - previousDepth)}rem"
                            viewBox="0 0 1 1"
                            preserveAspectRatio="none"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            overflow="visible">
                            <path
                                d={depth > previousDepth ?
                                    'M 0 0 C 0 0.5, 1 0.5, 1 1'
                                :   'M 1 0 C 1 0.5, 0 0.5, 0 1'}
                                vector-effect="non-scaling-stroke" />
                        </svg>
                    {/if}
                    <a
                        href="#{heading.id}"
                        data-toc-link
                        onclick={e => {
                            e.preventDefault();
                            navigateToHeading(heading.id);
                        }}
                        aria-current={isActive ? 'true' : undefined}
                        class="block border-l-2 border-line-subtle py-1.5 pl-5 text-xs leading-snug text-fg-muted no-underline transition-colors duration-150 hover:border-line-strong hover:text-fg aria-[current=true]:text-fg"
                        style:margin-left="calc({depth}rem - 0.125rem)">
                        <MdrsHtml
                            as="span"
                            html={formatHeadingText(heading.text)} />
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
                'group mdrs-details my-0 overflow-hidden rounded-md glass-card border border-line-subtle/60 text-fg shadow-md backdrop-blur-md select-none',
                className
            )}
            open={!defaultCollapsed}>
            <summary
                class="mdrs-details-summary flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 border-b border-transparent px-3.5 py-1.5 text-sm font-medium text-fg transition-colors select-none group-open:border-line-subtle hover:bg-surface-hover/50 dark:group-open:border-fg/10 [&::-webkit-details-marker]:hidden">
                <span class="inline-flex items-center gap-2">
                    <TableOfContentsIcon class="size-4 shrink-0 text-fg" />

                    <span
                        class="mdrs-details-title translate-y-px text-sm leading-none font-medium text-fg">
                        {title}
                    </span>
                </span>

                <span
                    class="mdrs-details-icon inline-flex shrink-0 items-center justify-center text-fg-muted"
                    aria-hidden="true">
                    <ChevronsUpDown class="size-3.5 group-open:hidden" />

                    <ChevronsDownUp class="hidden size-3.5 group-open:block" />
                </span>
            </summary>

            <div
                class="mdrs-details-body px-3.5 py-3 text-sm leading-relaxed font-normal text-fg-secondary">
                {@render tocList()}
            </div>
        </details>
    {:else}
        <nav
            aria-label="Table of contents"
            class={cn('flex flex-col select-none', className)}>
            <div class="mb-2 shrink-0 text-sm font-semibold text-fg select-none">
                {title}
            </div>

            {@render tocList()}
        </nav>
    {/if}
{/if}

<style>
    @reference "@idstead/ui/styles/global.css";

    :global(nav[aria-label='Table of contents'] code),
    :global(details.mdrs-details code) {
        @apply rounded-md bg-code-inline px-1.5 py-0.5 font-mono text-[0.85em] font-normal text-inherit;
    }

    :global(nav[aria-label='Table of contents'] kbd),
    :global(details.mdrs-details kbd) {
        @apply rounded-md border border-line-subtle bg-surface px-1 py-0.5 font-mono text-[0.75em];
    }
</style>
