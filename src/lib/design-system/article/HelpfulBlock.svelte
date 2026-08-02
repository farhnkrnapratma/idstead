<!-- @format -->
<script lang="ts">
  import Button from '../components/Button.svelte'
  import {cn} from '../utils/cn'

  interface Props {
    title?: string
    onVote?: (helpful: boolean) => void
    class?: string
  }

  let {
    title = 'Was this article helpful?',
    onVote,
    class: className = ''
  }: Props = $props()

  let voted = $state<boolean | null>(null)

  function handleVote(helpful: boolean) {
    voted = helpful
    onVote?.(helpful)
  }
</script>

<div
  class={cn(
    'my-10 flex flex-col items-center justify-between gap-4 rounded-2xl border border-border-subtle bg-surface/50 p-6 text-center shadow-xs select-none sm:flex-row sm:text-left',
    className
  )}>
  <div class="flex flex-col gap-0.5">
    <span class="text-xs font-bold text-text-primary">{title}</span>
    <span class="text-[11px] text-text-muted"
      >Let us know if you found this post useful.</span>
  </div>

  {#if voted !== null}
    <span class="flex items-center gap-1.5 text-xs font-semibold text-copilot">
      <i
        class="bi bi-check-circle-fill"
        aria-hidden="true"></i> Thanks for your feedback!
    </span>
  {:else}
    <div class="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        onclick={() => handleVote(true)}>
        <span
          class="material-symbols-rounded text-sm leading-none select-none"
          style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
          aria-hidden="true">thumb_up</span>
        <span>Yes</span>
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onclick={() => handleVote(false)}>
        <span
          class="material-symbols-rounded text-sm leading-none select-none"
          style="font-size: 16px; font-variation-settings: 'wght' 400, 'opsz' 20;"
          aria-hidden="true">thumb_down</span>
        <span>No</span>
      </Button>
    </div>
  {/if}
</div>
