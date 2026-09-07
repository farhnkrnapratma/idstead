<script lang="ts">
  import {pushState} from '$app/navigation';
  import {onMount} from 'svelte';
  import {
    TableOfContents as TableOfContentsIcon,
    ChevronsUpDown,
    ChevronsDownUp
  } from '@lucide/svelte';
  import {cn} from '../utils/cn';

  interface HeadingItem {
    id: string;
    text: string;
    level: number;
  }

  interface Props {
    headings: HeadingItem[];
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    class?: string;
  }

  let {
    headings = [],
    collapsible = false,
    defaultCollapsed = false,
    class: className = ''
  }: Props = $props();

  let activeHeadingId = $state('');
  let indicatorTop = $state(0);
  let indicatorHeight = $state(0);
  let isIndicatorVisible = $state(false);
  let tocListEl = $state<HTMLUListElement | null>(null);
  let scrollContainerEl = $state<HTMLDivElement | null>(null);

  const minLevel = $derived(
    headings.length > 0 ? Math.min(...headings.map(h => h.level)) : 2
  );

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
    window.addEventListener('scrollend', unpinAfterSettle, {once: true});
    unpinTimeout = setTimeout(unpinAfterSettle, 1500);
  }

  function navigateToHeading(id: string, instant = false) {
    const target = document.getElementById(id);
    if (!target) return;
    pinActiveHeading();
    target.scrollIntoView({
      behavior: instant ? 'auto' : 'smooth',
      block: 'start'
    });
    pushState(`#${id}`, {});
    activeHeadingId = id;
    updateIndicatorPos(id);
  }

  function updateIndicatorPos(
    id: string,
    forcedTop?: number,
    forcedHeight?: number
  ) {
    if (!tocListEl) return;
    const activeEl = tocListEl.querySelector(`[href="#${id}"]`) as HTMLElement;
    if (activeEl) {
      const top = forcedTop !== undefined ? forcedTop : activeEl.offsetTop;
      const height =
        forcedHeight !== undefined ? forcedHeight : activeEl.offsetHeight;
      indicatorTop = top;
      indicatorHeight = height;
      isIndicatorVisible = true;

      if (scrollContainerEl && !isPinnedByClick) {
        const cTop = scrollContainerEl.scrollTop;
        const cHeight = scrollContainerEl.clientHeight;
        if (top < cTop + 16 || top + height > cTop + cHeight - 16) {
          scrollContainerEl.scrollTo({
            top: Math.max(0, top - cHeight / 2 + height / 2),
            behavior: 'smooth'
          });
        }
      }
    }
  }

  onMount(() => {
    if (headings.length === 0) return;

    let headingObserver: IntersectionObserver | null = null;
    let rafId: number | null = null;

    const elements = headings
      .map(h => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);

    const updateScrollspyPosition = () => {
      if (isPinnedByClick) return;
      if (!tocListEl || headings.length === 0) return;
      const scrollY = window.scrollY;

      const tocLinks = headings
        .map(h => {
          const link = tocListEl?.querySelector(
            `[href="#${h.id}"]`
          ) as HTMLElement;
          return link ?
              {id: h.id, top: link.offsetTop, height: link.offsetHeight}
            : null;
        })
        .filter(
          (l): l is {id: string; top: number; height: number} => l !== null
        );

      if (tocLinks.length === 0) return;

      const viewportOffset = 180;
      const headingPositions = headings
        .map(h => {
          const el = document.getElementById(h.id);
          return el ? {id: h.id, top: el.getBoundingClientRect().top} : null;
        })
        .filter((h): h is {id: string; top: number} => h !== null);

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

    window.addEventListener('scroll', handleScroll, {passive: true});
    document.addEventListener('scroll', handleScroll, {
      capture: true,
      passive: true
    });

    headingObserver = new IntersectionObserver(
      entries => {
        if (isPinnedByClick) return;
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            activeHeadingId = entry.target.id;
            updateIndicatorPos(entry.target.id);
          }
        });
      },
      {root: null, rootMargin: '0px 0px -70% 0px', threshold: 0.1}
    );

    elements.forEach(el => headingObserver?.observe(el));

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll, {capture: true});
      headingObserver?.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
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
    return result;
  }
</script>

{#snippet tocList()}
  <div
    bind:this={scrollContainerEl}
    class="relative min-h-0 flex-1 [scrollbar-width:none] overflow-y-auto pr-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
    <ul
      id="toc-list"
      bind:this={tocListEl}
      class="relative flex min-h-full flex-col pl-3 font-sans-title"
      role="list">
      <div
        class="pointer-events-none absolute top-0 bottom-1 left-0 w-px bg-[#d5ded7] dark:bg-[#232925]">
      </div>

      {#if isIndicatorVisible}
        <div
          class="pointer-events-none absolute top-(--indicator-top) left-0 h-(--indicator-height) w-px bg-accent"
          style="--indicator-top: {indicatorTop}px; --indicator-height: {indicatorHeight}px;"
          aria-hidden="true">
        </div>
      {/if}

      {#each headings as heading, index (heading.id + '-' + index)}
        {@const isActive = activeHeadingId === heading.id}
        {@const depth = Math.max(0, heading.level - minLevel)}
        {@const isSub = depth > 0}
        {@const branchWidth = isSub ? 16 + (depth - 1) * 12 : 0}
        {@const hasTopGap = index !== 0 && depth === 0}
        <li
          class="text-xs {index === 0 ? 'mt-0'
          : hasTopGap ? 'mt-1.5'
          : isSub ? 'mt-0.5'
          : 'mt-1'}">
          <a
            href="#{heading.id}"
            onclick={e => {
              e.preventDefault();
              navigateToHeading(heading.id);
            }}
            aria-current={isActive ? 'true' : undefined}
            class="relative -ml-3 flex min-h-6 items-center rounded-r-xs py-0.5 pr-2 font-sans-title leading-snug transition-colors duration-150 ease-in-out hover:text-accent {(
              isActive
            ) ?
              isSub ? 'bg-accent/10 font-medium text-accent'
              : 'bg-accent/10 font-semibold text-accent'
            : isSub ?
              'font-normal text-text-secondary hover:bg-surface-hover/30'
            : 'font-medium text-text-primary hover:bg-surface-hover/30'}"
            style="padding-left: {isSub ? `${branchWidth + 8}px` : '10px'};">
            {#if isSub}
              <span
                class="pointer-events-none absolute top-1/2 left-0 h-0 border-t transition-colors duration-150 select-none {(
                  isActive
                ) ?
                  'border-accent'
                : 'border-[#d5ded7] dark:border-[#232925]'}"
                style="width: {branchWidth}px;"
                aria-hidden="true"></span>
            {/if}
            <span class="min-w-0 grow"
              >{@html formatHeadingText(heading.text)}</span>
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
        class="markdown-details-summary flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 border-b border-transparent px-3.5 py-1.5 font-sans-title text-sm font-medium text-text-primary transition-colors select-none group-open:border-border-subtle hover:bg-surface-hover/50 dark:group-open:border-white/10 [&::-webkit-details-marker]:hidden">
        <span class="inline-flex items-center gap-2">
          <TableOfContentsIcon class="size-4 shrink-0 text-text-primary" />
          <span
            class="markdown-details-title translate-y-px font-sans-title text-sm leading-none font-medium tracking-wide text-text-primary uppercase">
            IN THIS ARTICLE
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
        class="markdown-details-body px-3.5 py-3 font-sans-title text-sm leading-relaxed font-normal text-text-secondary">
        {@render tocList()}
      </div>
    </details>
  {:else}
    <nav
      aria-label="Table of contents"
      class={cn(
        'flex flex-col rounded-md glass-card p-4 select-none',
        className
      )}>
      <h3
        class="mb-3 shrink-0 font-sans-title text-xs font-bold tracking-wider text-text-secondary uppercase select-none">
        In this article
      </h3>
      {@render tocList()}
    </nav>
  {/if}
{/if}

<style>
  @reference "../../routes/global.css";

  :global(nav[aria-label='Table of contents'] code),
  :global(details.markdown-details code) {
    @apply rounded-md bg-code-inline-bg px-1.5 py-0.5 font-mono text-[0.85em] font-normal text-inherit;
  }
  :global(nav[aria-label='Table of contents'] kbd),
  :global(details.markdown-details kbd) {
    @apply rounded-md border border-border-subtle bg-surface-card px-1 py-0.5 font-mono text-[0.75em];
  }
</style>
