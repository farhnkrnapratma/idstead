<script lang="ts">
  import {Command} from '@lucide/svelte';
  import {cn} from '../utils/cn';

  interface Props {
    combo: string;
    active?: boolean;
    icon?: boolean;
    class?: string;
  }

  let {
    combo,
    active = false,
    icon = false,
    class: className = ''
  }: Props = $props();
</script>

<kbd
  class={cn(
    'inline-flex h-[18px] shrink-0 items-center gap-1 rounded-md border px-1.5 font-mono text-3xs font-medium transition-colors select-none',
    active ?
      'border-accent/30 bg-accent/25 text-accent'
    : 'border-border-subtle/60 bg-surface-elevated text-text-secondary group-hover:border-accent/30 group-hover:bg-accent/15 group-hover:text-accent',
    className
  )}>
  {#if icon}
    <Command
      class="size-2.5"
      aria-hidden="true" />
  {/if}
  {combo}
</kbd>
