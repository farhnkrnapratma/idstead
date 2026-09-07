<script lang="ts">
  import {X} from '@lucide/svelte';
  import IconButton from './IconButton.svelte';
  import {cn} from '../utils/cn';

  interface Props {
    title: string;
    description?: string;
    showClose?: boolean;
    onClose?: () => void;
    class?: string;
  }

  let {
    title,
    description = '',
    showClose = false,
    onClose,
    class: className = ''
  }: Props = $props();
</script>

<div
  class={cn(
    'relative flex flex-col gap-1 pr-6 text-left select-none',
    className
  )}>
  <h2
    id="dialog-title"
    class="font-sans-title text-base font-bold text-text-primary">
    {title}
  </h2>
  {#if description}
    <p
      id="dialog-desc"
      class="mt-1 text-xs leading-relaxed text-text-secondary">
      {description}
    </p>
  {/if}

  {#if showClose && onClose}
    <div class="absolute top-0 right-0">
      <IconButton
        ariaLabel="Close dialog"
        variant="ghost"
        size="sm"
        onclick={onClose}>
        <X class="size-3.5" />
      </IconButton>
    </div>
  {/if}
</div>
