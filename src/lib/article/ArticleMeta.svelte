<!-- @format -->
<script lang="ts">
  import {cn} from '../utils/cn'
  import {
    formatCommentCount,
    formatViewCount,
    formatAbsoluteDate
  } from '../utils/formatters'
  import RelativeTime from '../components/RelativeTime.svelte'

  interface Props {
    date?: string
    updatedAt?: string
    readingTime?: string
    views?: number
    commentsCount?: number
    author?: string
    class?: string
  }

  let {
    date = '',
    updatedAt = '',
    readingTime = '',
    views,
    commentsCount,
    author = '',
    class: className = ''
  }: Props = $props()

  const parts = $derived(
    (
      [
        author ? 'author' : null,
        date ? 'date' : null,
        readingTime ? 'readingTime' : null,
        commentsCount !== undefined ? 'comments' : null,
        views !== undefined ? 'views' : null
      ] as const
    ).filter((p): p is NonNullable<typeof p> => p !== null)
  )
</script>

<div
  class={cn(
    'flex [scrollbar-width:none] items-center gap-x-1.5 overflow-x-auto font-sans text-xs font-semibold whitespace-nowrap text-text-muted select-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
    className
  )}>
  {#each parts as part, i (part)}
    {#if i > 0}<span aria-hidden="true">&middot;</span>{/if}
    {#if part === 'author'}
      <span class="text-text-secondary">{author}</span>
    {:else if part === 'date'}
      <RelativeTime
        {date}
        tag="time" />
      <span aria-hidden="true">&middot;</span>
      <span>Last updated {formatAbsoluteDate(updatedAt || date)}</span>
    {:else if part === 'readingTime'}
      <span>{readingTime}</span>
    {:else if part === 'comments'}
      <span>{formatCommentCount(commentsCount)}</span>
    {:else if part === 'views'}
      <span>{formatViewCount(views)}</span>
    {/if}
  {/each}
</div>
