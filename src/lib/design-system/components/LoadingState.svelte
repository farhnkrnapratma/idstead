<!-- @format -->
<script lang="ts">
  import {cn} from '../utils/cn'

  interface Props {
    label?: string
    size?: 'sm' | 'md' | 'lg'
    class?: string
  }

  let {
    label = 'Loading content...',
    size = 'md',
    class: className = ''
  }: Props = $props()

  const sizeStyles = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-3'
  }
</script>

<div
  role="status"
  aria-live="polite"
  aria-busy="true"
  class={cn(
    'flex flex-col items-center justify-center gap-3 p-8 text-center select-none',
    className
  )}>
  <div
    class={cn(
      'animate-spin rounded-full border-border-subtle border-t-copilot',
      sizeStyles[size]
    )}>
  </div>
  {#if label}
    <span class="text-xs font-medium text-text-muted">{label}</span>
  {/if}
</div>
