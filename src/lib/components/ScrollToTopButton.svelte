<script lang="ts">
  import {fade} from 'svelte/transition';
  import {page} from '$app/state';
  import {ArrowUp} from '@lucide/svelte';
  import {scrollToTop} from '$lib/utils/scroll';
  import {scrollStore} from '../stores/scrollStore.svelte';
  import Tooltip from './Tooltip.svelte';

  const RING_RADIUS = 16;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  interface Props {
    show?: boolean;
    hasBottomNav?: boolean;
    class?: string;
    onClick?: () => void;
    progress?: number;
  }

  let {
    show = true,
    hasBottomNav,
    class: className = '',
    onClick,
    progress
  }: Props = $props();

  const isMainPage = $derived(
    hasBottomNav !== undefined ? hasBottomNav : page.url.pathname === '/'
  );
  const currentProgress = $derived(
    progress !== undefined ? progress : scrollStore.progress
  );
</script>

{#if show}
  <div
    class="fixed right-3 z-40 md:right-6 md:bottom-6 {isMainPage ?
      'bottom-[calc(4.25rem+env(safe-area-inset-bottom))]'
    : 'bottom-[calc(0.75rem+env(safe-area-inset-bottom))]'} {className}">
    <Tooltip
      content="Scroll to top"
      placement="top"
      align="right">
      <div class="relative inline-flex">
        <button
          transition:fade={{duration: 150}}
          class="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full glass-button px-0 text-xs font-semibold text-text-primary shadow-md transition-colors hover:text-accent md:h-10 md:w-10 md:shadow-lg"
          onclick={onClick || (() => scrollToTop('smooth'))}
          aria-label="Scroll to top">
          <ArrowUp class="size-4.5 shrink-0 md:size-5" />
        </button>
        <svg
          class="pointer-events-none absolute inset-0 h-9 w-9 -rotate-90 md:h-10 md:w-10"
          viewBox="0 0 36 36"
          aria-hidden="true">
          <circle
            cx="18"
            cy="18"
            r={RING_RADIUS}
            fill="none"
            stroke="var(--color-border-subtle)"
            stroke-width="2" />
          <circle
            cx="18"
            cy="18"
            r={RING_RADIUS}
            fill="none"
            stroke="var(--color-accent)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-dasharray={RING_CIRCUMFERENCE}
            stroke-dashoffset={RING_CIRCUMFERENCE * (1 - currentProgress / 100)}
            class="transition-[stroke-dashoffset] duration-300 ease-out" />
        </svg>
      </div>
    </Tooltip>
  </div>
{/if}
