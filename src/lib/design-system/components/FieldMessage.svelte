<!-- @format -->
<script lang="ts">
  import {cn} from '../utils/cn'

  interface Props {
    type?: 'error' | 'success' | 'warning' | 'info'
    id?: string
    message: string
    class?: string
  }

  let {type = 'error', id, message, class: className = ''}: Props = $props()

  const typeStyles = {
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
    role={type === 'error' ? 'alert' : undefined}
    aria-live={type === 'error' ? 'polite' : 'off'}
    class={cn(
      'mt-1 flex items-center gap-1.5 text-[11px] leading-tight font-medium select-none',
      typeStyles[type],
      className
    )}
  >
    <i class="bi {iconStyles[type]} text-xs" aria-hidden="true"></i>
    <span>{message}</span>
  </div>
{/if}
