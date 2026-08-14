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
    title = 'Was this helpful?',
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
  class={cn('flex flex-col gap-2 px-0 py-2 text-left select-none', className)}>
  <span class="text-xs font-semibold text-text-muted">{title}</span>

  {#if voted !== null}
    <span class="flex items-center gap-1.5 text-xs font-semibold text-copilot">
      <i
        class="bi bi-check-circle-fill"
        aria-hidden="true"></i> Thanks for your feedback!
    </span>
  {:else}
    <div class="flex items-center gap-1.5">
      <Button
        type="Secondary"
        size="sm"
        class="h-6.5! gap-1.5! px-2.5! text-xs! text-text-muted!"
        onclick={() => handleVote(true)}>
        <i
          class="bi bi-hand-thumbs-up text-xs leading-none text-text-muted select-none"
          aria-hidden="true"></i>
        <span class="text-text-muted">Yes</span>
      </Button>
      <Button
        type="Secondary"
        size="sm"
        class="h-6.5! gap-1.5! px-2.5! text-xs! text-text-muted!"
        onclick={() => handleVote(false)}>
        <i
          class="bi bi-hand-thumbs-down text-xs leading-none text-text-muted select-none"
          aria-hidden="true"></i>
        <span class="text-text-muted">No</span>
      </Button>
    </div>
  {/if}
</div>
