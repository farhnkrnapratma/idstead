<script lang="ts">
  import {
    ChevronFirst,
    ChevronLast,
    ChevronLeft,
    ChevronRight
  } from '@lucide/svelte';
  import {cn} from '../utils/cn';
  import {buttonKey} from '$lib/shortcuts';
  import Button from './Button.svelte';

  interface Props {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    size?: 'md' | 'sm';
    class?: string;
  }

  let {
    page,
    totalPages,
    onPageChange,
    size = 'md',
    class: className = ''
  }: Props = $props();

  const showJump = $derived(totalPages > 5);
  const compact = $derived(size === 'sm');
  const controlClass = $derived(
    compact ? 'size-6 shrink-0 p-0' : 'size-9 shrink-0 p-0'
  );
  const pageClass = $derived(compact ? 'h-6 w-6' : 'h-9 w-9');

  function goTo(target: number) {
    const clamped = Math.min(Math.max(target, 1), totalPages);
    if (clamped !== page) onPageChange(clamped);
  }

  const pageNumbers = $derived.by(() => {
    const pages: number[] = [];
    const windowSize = 1;

    const addPage = (n: number) => {
      if (!pages.includes(n)) pages.push(n);
    };

    addPage(1);
    for (
      let n = Math.max(2, page - windowSize);
      n <= Math.min(totalPages - 1, page + windowSize);
      n++
    ) {
      addPage(n);
    }
    if (totalPages > 1) addPage(totalPages);

    const withEllipses: (number | 'ellipsis')[] = [];
    let prev = 0;
    for (const n of pages) {
      if (prev && n - prev > 1) withEllipses.push('ellipsis');
      withEllipses.push(n);
      prev = n;
    }
    return withEllipses;
  });
</script>

<nav
  aria-label="Pagination"
  class={cn(
    'flex w-full items-center justify-between gap-1.5 select-none',
    className
  )}>
  <div class="flex items-center gap-1.5">
    {#if showJump}
      <Button
        type="outline"
        size={compact ? '3xs' : 'md'}
        class={controlClass}
        onclick={() => goTo(1)}
        disabled={page <= 1}
        aria-label="First page">
        <ChevronFirst class="size-3" />
      </Button>
    {/if}
    <Button
      type="outline"
      size={compact ? '3xs' : 'md'}
      class={controlClass}
      onclick={() => goTo(page - 1)}
      disabled={page <= 1}
      keyboardShortcut={buttonKey('pagePrev')}
      shortcutLabel="Previous page"
      aria-label="Previous page">
      <ChevronLeft class="size-3" />
    </Button>
  </div>

  <div
    class="flex scrollbar-none items-center justify-center gap-1 overflow-x-auto">
    {#each pageNumbers as entry, i (entry === 'ellipsis' ? `ellipsis-${i}` : entry)}
      {#if entry === 'ellipsis'}
        <span
          class={cn(
            'inline-flex shrink-0 items-center justify-center text-xs font-semibold text-text-muted',
            pageClass
          )}
          aria-hidden="true">
          &hellip;
        </span>
      {:else}
        <Button
          type={entry === page ? 'primary' : 'outline'}
          size={compact ? '3xs' : 'md'}
          class={cn(controlClass, 'text-xs font-bold sm:text-xs')}
          onclick={() => goTo(entry)}
          aria-label="Go to page {entry}"
          aria-current={entry === page ? 'page' : undefined}>
          {entry}
        </Button>
      {/if}
    {/each}
  </div>

  <div class="flex items-center gap-1.5">
    <Button
      type="outline"
      size={compact ? '3xs' : 'md'}
      class={controlClass}
      onclick={() => goTo(page + 1)}
      disabled={page >= totalPages}
      keyboardShortcut={buttonKey('pageNext')}
      shortcutLabel="Next page"
      aria-label="Next page">
      <ChevronRight class="size-3" />
    </Button>
    {#if showJump}
      <Button
        type="outline"
        size={compact ? '3xs' : 'md'}
        class={controlClass}
        onclick={() => goTo(totalPages)}
        disabled={page >= totalPages}
        aria-label="Last page">
        <ChevronLast class="size-3" />
      </Button>
    {/if}
  </div>
</nav>
