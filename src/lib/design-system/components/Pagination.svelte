<!-- @format -->
<script lang="ts">
  import {cn} from '../utils/cn'

  interface Props {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
    siblingCount?: number
    class?: string
  }

  let {
    currentPage,
    totalPages,
    onPageChange,
    siblingCount = 1,
    class: className = ''
  }: Props = $props()

  function range(start: number, end: number): number[] {
    return Array.from({length: end - start + 1}, (_, i) => start + i)
  }

  const pageNumbers = $derived.by((): (number | 'ellipsis')[] => {
    const total = Math.max(totalPages, 1)
    const current = Math.min(Math.max(currentPage, 1), total)
    const totalVisible = siblingCount * 2 + 5

    if (total <= totalVisible) {
      return range(1, total)
    }

    const leftSiblingIndex = Math.max(current - siblingCount, 1)
    const rightSiblingIndex = Math.min(current + siblingCount, total)

    const shouldShowLeftEllipsis = leftSiblingIndex > 2
    const shouldShowRightEllipsis = rightSiblingIndex < total - 1

    if (!shouldShowLeftEllipsis && shouldShowRightEllipsis) {
      const leftItemCount = 3 + siblingCount * 2
      return [...range(1, leftItemCount), 'ellipsis', total]
    }

    if (shouldShowLeftEllipsis && !shouldShowRightEllipsis) {
      const rightItemCount = 3 + siblingCount * 2
      return [1, 'ellipsis', ...range(total - rightItemCount + 1, total)]
    }

    return [
      1,
      'ellipsis',
      ...range(leftSiblingIndex, rightSiblingIndex),
      'ellipsis',
      total
    ]
  })

  function goToPage(page: number) {
    if (page < 1 || page > totalPages || page === currentPage) return
    onPageChange(page)
  }
</script>

{#if totalPages > 1}
  <nav aria-label="Pagination" class={cn('flex items-center gap-1', className)}>
    <button
      type="button"
      disabled={currentPage <= 1}
      onclick={() => goToPage(currentPage - 1)}
      aria-label="Previous page"
      class="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border-subtle bg-surface text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-50">
      <i class="bi bi-chevron-left text-sm" aria-hidden="true"></i>
    </button>

    <ul class="flex items-center gap-1">
      {#each pageNumbers as page, i (page === 'ellipsis' ? `ellipsis-${i}` : page)}
        <li>
          {#if page === 'ellipsis'}
            <span
              class="inline-flex h-9 w-9 items-center justify-center text-sm text-text-muted select-none"
              aria-hidden="true">
              &hellip;
            </span>
          {:else}
            <button
              type="button"
              aria-label="Page {page}"
              aria-current={page === currentPage ? 'page' : undefined}
              onclick={() => goToPage(page)}
              class={cn(
                'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
                page === currentPage
                  ? 'bg-copilot text-text-on-accent'
                  : 'border border-border-subtle bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              )}>
              {page}
            </button>
          {/if}
        </li>
      {/each}
    </ul>

    <button
      type="button"
      disabled={currentPage >= totalPages}
      onclick={() => goToPage(currentPage + 1)}
      aria-label="Next page"
      class="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border-subtle bg-surface text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-50">
      <i class="bi bi-chevron-right text-sm" aria-hidden="true"></i>
    </button>
  </nav>
{/if}
