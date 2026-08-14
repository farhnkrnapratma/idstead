<!-- @format -->
<script lang="ts">
  import {cn} from '../utils/cn'

  interface Props {
    variant?: 'error' | 'success' | 'warning' | 'info'
    id?: string
    message: string
    class?: string
  }

  let {variant = 'error', id, message, class: className = ''}: Props = $props()

  const variantStyles = {
    error: 'text-danger',
    success: 'text-copilot',
    warning: 'text-warning',
    info: 'text-text-muted'
  }

  const iconStyles = {
    error: 'bi-exclamation-circle-fill',
    success: 'bi-check-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    info: 'bi-info-circle-fill'
  }
</script>

{#if message}
  <div
    {id}
    role={variant === 'error' ? 'alert' : undefined}
    aria-live={variant === 'error' ? 'polite' : 'off'}
    class={cn(
      'mt-1 flex items-center gap-1.5 text-xxs leading-tight font-medium select-none',
      variantStyles[variant],
      className
    )}>
    <i
      class="bi {iconStyles[variant]} text-xs"
      aria-hidden="true"></i>
    <span>{message}</span>
  </div>
{/if}
