<!-- @format -->
<script lang="ts">
  import Button from './Button.svelte'
  import {cn} from '../utils/cn'

  interface Props {
    title?: string
    description?: string
    icon?: string
    onRetry?: () => void
    retryLabel?: string
    class?: string
  }

  let {
    title = 'Something went wrong',
    description = 'We encountered an unexpected error while loading this content.',
    icon = 'bi-exclamation-triangle',
    onRetry,
    retryLabel = 'Try Again',
    class: className = ''
  }: Props = $props()
</script>

<div
  role="alert"
  aria-live="assertive"
  class={cn(
    'flex flex-col items-center justify-center rounded-2xl border border-danger/30 bg-danger-subtle/10 p-8 text-center select-none',
    className
  )}>
  <div
    class="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-subtle/30 text-danger">
    <i class="bi {icon} text-2xl" aria-hidden="true"></i>
  </div>
  <h3 class="text-sm font-bold text-text-primary">{title}</h3>
  {#if description}
    <p class="mt-1 max-w-xs text-xs text-text-secondary">{description}</p>
  {/if}

  {#if onRetry}
    <div class="mt-4">
      <Button
        variant="secondary"
        size="sm"
        leadingIcon="bi-arrow-clockwise"
        onclick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  {/if}
</div>
