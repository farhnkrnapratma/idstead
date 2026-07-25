<!-- @format -->
<script lang="ts">
  import {cn} from '../utils/cn'

  interface Props {
    date?: string
    readingTime?: string
    views?: number
    commentsCount?: number
    author?: string
    class?: string
  }

  let {
    date = '',
    readingTime = '',
    views,
    commentsCount,
    author = '',
    class: className = ''
  }: Props = $props()
</script>

<div
  class={cn(
    'flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-muted select-none',
    className
  )}>
  {#if author}
    <div class="flex items-center gap-1.5 font-medium text-text-secondary">
      <i class="bi bi-person-circle text-copilot" aria-hidden="true"></i>
      <span>{author}</span>
    </div>
  {/if}

  {#if date}
    <div class="flex items-center gap-1.5">
      <i class="bi bi-calendar3" aria-hidden="true"></i>
      <time datetime={date}>{date}</time>
    </div>
  {/if}

  {#if readingTime}
    <div class="flex items-center gap-1.5">
      <i class="bi bi-clock" aria-hidden="true"></i>
      <span>{readingTime}</span>
    </div>
  {/if}

  {#if views !== undefined}
    <div class="flex items-center gap-1.5">
      <i class="bi bi-eye" aria-hidden="true"></i>
      <span>{views} views</span>
    </div>
  {/if}

  {#if commentsCount !== undefined}
    <div class="flex items-center gap-1.5">
      <i class="bi bi-chat-text" aria-hidden="true"></i>
      <span>{commentsCount} comments</span>
    </div>
  {/if}
</div>
