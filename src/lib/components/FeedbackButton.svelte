<!-- @format -->
<script lang="ts">
  import {fade} from 'svelte/transition'
  import {goto} from '$app/navigation'

  interface Props {
    show?: boolean
    class?: string
  }

  let {show = true, class: className = ''}: Props = $props()
</script>

{#if show}
  <button
    transition:fade={{duration: 150}}
    class="fixed bottom-4 left-4 z-50 inline-flex h-10 w-10 cursor-pointer items-center justify-center gap-2 rounded-sm glass-button px-0 text-xs font-semibold text-text-primary shadow-lg sm:bottom-6 sm:left-6 sm:w-auto sm:px-4 sm:text-sm {className}"
    onclick={() => goto('/feedback')}
    title="Report an issue or give feedback"
    aria-label="Report an issue or give feedback">
    <i
      class="bi bi-bug-fill text-sm"
      aria-hidden="true"></i>
    <span class="hidden sm:inline">Feedback</span>
  </button>
{/if}
