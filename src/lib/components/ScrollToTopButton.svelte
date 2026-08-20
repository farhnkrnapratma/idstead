<script lang="ts">
  import {fade} from 'svelte/transition';
  import {ArrowUp} from '@lucide/svelte';
  import {scrollToTop} from '$lib/utils/scroll';

  interface Props {
    show?: boolean;
    class?: string;
  }

  let {show = true, class: className = ''}: Props = $props();
</script>

{#if show}
  <div
    class="group fixed right-4 bottom-4 z-50 sm:right-6 sm:bottom-6 {className}">
    <button
      transition:fade={{duration: 150}}
      class="inline-flex h-10 w-10 cursor-pointer items-center justify-center gap-2 rounded-sm glass-button px-0 text-xs font-semibold text-text-primary shadow-lg sm:w-auto sm:px-4 sm:text-sm"
      onclick={() => scrollToTop('smooth')}
      aria-label="Scroll to top">
      <ArrowUp class="size-4 shrink-0" />
      <span class="hidden sm:inline">Scroll to top</span>
    </button>

    <div
      role="tooltip"
      class="pointer-events-none absolute right-0 bottom-[calc(100%+6px)] z-70 rounded-sm glass-overlay px-2 py-1 text-3xs font-medium whitespace-nowrap text-text-primary opacity-0 shadow-lg transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 sm:hidden">
      <span class="relative z-10">Scroll to top</span>
    </div>
  </div>
{/if}
