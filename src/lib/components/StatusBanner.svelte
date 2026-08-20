<script lang="ts">
  import {
    Info,
    CheckCircle2,
    AlertTriangle,
    AlertOctagon
  } from '@lucide/svelte';
  import {cn} from '../utils/cn';

  interface Props {
    variant?: 'info' | 'success' | 'warning' | 'error';
    title?: string;
    message: string;
    class?: string;
  }

  let {
    variant = 'info',
    title = '',
    message,
    class: className = ''
  }: Props = $props();

  const variantStyles = {
    info: 'border-border-default bg-surface/70 text-text-primary',
    success: 'border-copilot/30 bg-copilot-subtle/20 text-text-primary',
    warning: 'border-warning/30 bg-warning/10 text-text-primary',
    error: 'border-danger/30 bg-danger-subtle/20 text-text-primary'
  };
</script>

<div
  role={variant === 'error' ? 'alert' : 'status'}
  aria-live={variant === 'error' ? 'assertive' : 'polite'}
  class={cn(
    'flex items-start gap-3 rounded-sm glass-card p-4 text-xs select-none',
    variantStyles[variant],
    className
  )}>
  {#if variant === 'success'}
    <CheckCircle2 class="mt-0.5 size-4 shrink-0 self-start text-copilot" />
  {:else if variant === 'warning'}
    <AlertTriangle class="mt-0.5 size-4 shrink-0 self-start text-warning" />
  {:else if variant === 'error'}
    <AlertOctagon class="mt-0.5 size-4 shrink-0 self-start text-danger" />
  {:else}
    <Info class="mt-0.5 size-4 shrink-0 self-start text-text-muted" />
  {/if}
  <div class="flex min-w-0 flex-1 flex-col gap-0.5">
    {#if title}
      <span class="leading-snug font-bold">{title}</span>
    {/if}
    <span class="leading-relaxed font-medium wrap-break-word">{message}</span>
  </div>
</div>
