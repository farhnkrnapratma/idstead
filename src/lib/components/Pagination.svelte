<script lang="ts">
  import {ArrowLeft, ArrowRight} from '@lucide/svelte';
  import {cn} from '../utils/cn';
  import Button from './Button.svelte';

  interface Props {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    class?: string;
  }

  let {page, totalPages, onPageChange, class: className = ''}: Props = $props();

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
  <Button
    type="outline"
    size="md"
    class="size-9 shrink-0 p-0 sm:h-9 sm:w-auto sm:px-4"
    onclick={() => goTo(page - 1)}
    disabled={page <= 1}
    aria-label="Previous page">
    <ArrowLeft class="size-3.5" />
    <span class="hidden sm:inline">Previous</span>
  </Button>

  <div
    class="flex scrollbar-none items-center justify-center gap-1 overflow-x-auto">
    {#each pageNumbers as entry, i (entry === 'ellipsis' ? `ellipsis-${i}` : entry)}
      {#if entry === 'ellipsis'}
        <span
          class="inline-flex h-9 w-9 shrink-0 items-center justify-center text-xs font-semibold text-text-muted"
          aria-hidden="true">
          &hellip;
        </span>
      {:else}
        <button
          type="button"
          onclick={() => goTo(entry)}
          aria-label="Go to page {entry}"
          aria-current={entry === page ? 'page' : undefined}
          class={cn(
            'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
            entry === page ?
              'bg-accent text-white shadow-xs'
            : 'border border-border-subtle bg-surface text-text-primary hover:bg-surface-hover hover:text-accent'
          )}>
          {entry}
        </button>
      {/if}
    {/each}
  </div>

  <Button
    type="outline"
    size="md"
    class="size-9 shrink-0 p-0 sm:h-9 sm:w-auto sm:px-4"
    onclick={() => goTo(page + 1)}
    disabled={page >= totalPages}
    aria-label="Next page">
    <span class="hidden sm:inline">Next</span>
    <ArrowRight class="size-3.5" />
  </Button>
</nav>
