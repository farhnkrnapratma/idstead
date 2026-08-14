<!-- @format -->
<script lang="ts">
  import {fade} from 'svelte/transition'
  import {scrollToTop} from '$lib/utils/scroll'

  interface Props {
    show?: boolean
    class?: string
  }

  let {show = true, class: className = ''}: Props = $props()
</script>

{#if show}
  <button
    transition:fade={{duration: 150}}
    class="fixed right-4 bottom-4 z-50 inline-flex h-10 w-10 cursor-pointer items-center justify-center gap-2 rounded-sm glass-button px-0 text-xs font-semibold text-text-primary shadow-lg sm:right-6 sm:bottom-6 sm:w-auto sm:px-4 sm:text-sm {className}"
    onclick={() => scrollToTop('smooth')}
    title="Scroll to top"
    aria-label="Scroll to top">
    <i
      class="bi bi-arrow-bar-up text-sm"
      aria-hidden="true"></i>
    <span class="hidden sm:inline">Scroll to top</span>
  </button>
{/if}
