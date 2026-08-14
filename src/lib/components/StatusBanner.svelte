<!-- @format -->
<script lang="ts">
  import {cn} from '../utils/cn'

  interface Props {
    variant?: 'info' | 'success' | 'warning' | 'error'
    title?: string
    message: string
    class?: string
  }

  let {
    variant = 'info',
    title = '',
    message,
    class: className = ''
  }: Props = $props()

  const variantStyles = {
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
  role={variant === 'error' ? 'alert' : 'status'}
  aria-live={variant === 'error' ? 'assertive' : 'polite'}
  class={cn(
    'flex items-start gap-3 rounded-sm glass-card p-4 text-xs select-none',
    variantStyles[variant],
    className
  )}>
  <i
    class="bi {iconStyles[
      variant
    ]} mt-[1.5px] shrink-0 self-start text-base leading-none"
    aria-hidden="true"></i>
  <div class="flex min-w-0 flex-1 flex-col gap-0.5">
    {#if title}
      <span class="leading-snug font-bold">{title}</span>
    {/if}
    <span class="leading-relaxed font-medium wrap-break-word">{message}</span>
  </div>
</div>
