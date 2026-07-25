<!-- @format -->
<script lang="ts">
  import FilterChip from './FilterChip.svelte'
  import Button from '../Button.svelte'
  import {cn} from '../../utils/cn'

  interface ChipItem {
    id: string
    type: string
    value: string
    label: string
  }

  interface Props {
    chips: ChipItem[]
    onRemove?: (type: string, value: string) => void
    onClearAll?: () => void
    clearAllLabel?: string
    class?: string
  }

  let {
    chips = [],
    onRemove = () => {},
    onClearAll = () => {},
    clearAllLabel = 'Clear all',
    class: className = ''
  }: Props = $props()
</script>

{#if chips.length > 0}
  <div
    class={cn('flex flex-wrap items-center gap-2 pt-2 select-none', className)}
    role="region"
    aria-label="Active filters">
    {#each chips as chip (chip.id)}
      <FilterChip
        label={chip.type}
        value={chip.value}
        onRemove={() => onRemove(chip.type, chip.value)} />
    {/each}

    <Button
      variant="ghost"
      size="sm"
      onclick={onClearAll}
      class="text-xs text-text-muted hover:text-text-primary">
      {clearAllLabel}
    </Button>
  </div>
{/if}
