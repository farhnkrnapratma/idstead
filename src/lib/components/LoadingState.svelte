<script lang="ts">
  import {cn} from '../utils/cn';

  interface Props {
    label?: string;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'skeleton' | 'spinner';
    count?: number;
    class?: string;
  }

  let {
    label = 'Loading content...',
    size = 'md',
    variant = 'skeleton',
    count = 3,
    class: className = ''
  }: Props = $props();

  const sizeStyles = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-3'
  };
</script>

{#if variant === 'skeleton'}
  <div
    role="status"
    aria-live="polite"
    aria-busy="true"
    class={cn('w-full space-y-3 p-4 select-none', className)}>
    {#each Array.from({length: count}, (_, i) => i) as itemIndex (itemIndex)}
      <div
        class="animate-pulse rounded-sm border border-border-subtle bg-surface-card p-4 shadow-2xs">
        <div class="flex items-center gap-3">
          <div
            class="h-8 w-8 shrink-0 animate-pulse rounded-full bg-surface-hover">
          </div>
          <div class="flex-1 space-y-2">
            <div class="h-3.5 w-2/5 animate-pulse rounded bg-surface-hover">
            </div>
            <div class="h-2.5 w-4/5 animate-pulse rounded bg-border-subtle">
            </div>
          </div>
        </div>
      </div>
    {/each}
    {#if label}
      <span class="sr-only">{label}</span>
    {/if}
  </div>
{:else}
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
{/if}
