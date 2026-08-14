<!-- @format -->
<script lang="ts">
  import {fade} from 'svelte/transition'
  import {toastStore} from '../stores/toastStore.svelte'
  import {cn} from '../utils/cn'

  interface Props {
    class?: string
  }

  let {class: className = ''}: Props = $props()
</script>

{#if toastStore.visible}
  <div
    transition:fade={{duration: 150}}
    role="status"
    aria-live="polite"
    class={cn(
      'fixed bottom-6 left-1/2 z-200 flex -translate-x-1/2 items-center gap-2 rounded-sm glass-overlay px-4 py-2 text-xs font-semibold text-text-primary',
      className
    )}>
    <i
      class="bi {toastStore.type === 'error' ?
        'bi-exclamation-circle-fill text-danger'
      : 'bi-check-circle-fill text-copilot'} text-sm"
      aria-hidden="true"></i>
    {toastStore.message}
  </div>
{/if}
