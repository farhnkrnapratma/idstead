<script lang="ts">
  import {fade} from 'svelte/transition';
  import {goto} from '$app/navigation';
  import {page} from '$app/state';
  import {MessageSquareWarning} from '@lucide/svelte';
  import Tooltip from './Tooltip.svelte';

  interface Props {
    show?: boolean;
    hasBottomNav?: boolean;
    class?: string;
  }

  let {show = true, hasBottomNav, class: className = ''}: Props = $props();

  const isMainPage = $derived(
    hasBottomNav !== undefined ? hasBottomNav : page.url.pathname === '/'
  );
</script>

{#if show}
  <div
    class="fixed left-3 z-40 md:bottom-6 md:left-6 {isMainPage ?
      'bottom-[calc(4.25rem+env(safe-area-inset-bottom))]'
    : 'bottom-[calc(0.75rem+env(safe-area-inset-bottom))]'} {className}">
    <Tooltip
      content="Feedback"
      placement="top"
      align="left">
      <button
        transition:fade={{duration: 150}}
        class="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full glass-button px-0 text-xs font-semibold text-text-primary shadow-md md:h-10 md:w-10 md:shadow-lg"
        onclick={() => goto('/feedback')}
        aria-label="Report an issue or give feedback">
        <MessageSquareWarning class="size-4.5 shrink-0 md:size-5" />
      </button>
    </Tooltip>
  </div>
{/if}
