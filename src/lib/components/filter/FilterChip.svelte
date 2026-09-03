<script lang="ts">
  import {X} from '@lucide/svelte';
  import {cn} from '../../utils/cn';

  interface Props {
    label: string;
    value: string;
    onRemove?: () => void;
    class?: string;
  }

  let {
    label,
    value,
    onRemove = () => {},
    class: className = ''
  }: Props = $props();
</script>

<div
  class={cn(
    'inline-flex items-center gap-1.5 rounded-sm border border-border-subtle/50 bg-surface-card/85 px-3 py-1 font-sans-title text-xs font-semibold text-text-primary shadow-2xs select-none',
    className
  )}>
  <span class="text-text-secondary">{label}:</span>
  <span>{value}</span>
  <button
    type="button"
    onclick={onRemove}
    aria-label="Remove filter: {label} {value}"
    class="ml-0.5 inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-copilot">
    <X class="size-3.5 leading-none" />
  </button>
</div>
