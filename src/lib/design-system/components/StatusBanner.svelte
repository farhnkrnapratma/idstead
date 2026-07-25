<!-- @format -->
<script lang="ts">
  import {cn} from '../utils/cn'

  interface Props {
    type?: 'info' | 'success' | 'warning' | 'error'
    title?: string
    message: string
    class?: string
  }

  let {
    type = 'info',
    title = '',
    message,
    class: className = ''
  }: Props = $props()

  const typeStyles = {
    info: 'border-border-default bg-surface/70 text-text-primary',
    success: 'border-copilot/30 bg-copilot-subtle/20 text-text-primary',
    warning: 'border-warning/30 bg-warning/10 text-text-primary',
    error: 'border-danger/30 bg-danger-subtle/20 text-text-primary'
  }

  const iconStyles = {
    info: 'bi-info-circle-fill text-text-muted',
    success: 'bi-check-circle-fill text-copilot',
    warning: 'bi-exclamation-triangle-fill text-warning',
    error: 'bi-exclamation-octagon-fill text-danger'
  }
</script>

<div
  role={type === 'error' ? 'alert' : 'status'}
  aria-live={type === 'error' ? 'assertive' : 'polite'}
  class={cn(
    'flex items-start gap-3 rounded-2xl border p-4 text-xs shadow-xs backdrop-blur-md select-none',
    typeStyles[type],
    className
  )}>
  <i class="bi {iconStyles[type]} mt-0.5 shrink-0 text-base" aria-hidden="true"
  ></i>
  <div class="flex flex-col gap-0.5">
    {#if title}
      <span class="font-bold">{title}</span>
    {/if}
    <span class="leading-relaxed font-medium">{message}</span>
  </div>
</div>
