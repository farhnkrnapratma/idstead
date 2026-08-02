<!-- @format -->
<script lang="ts">
  import {cn} from '../../utils/cn'
  import DropdownTrigger from './DropdownTrigger.svelte'

  interface SortOption {
    value: string
    label: string
  }

  interface Props {
    fields: SortOption[]
    currentField: string
    currentDirection: 'asc' | 'desc'
    onFieldChange?: (field: string) => void
    onDirectionToggle?: () => void
    class?: string
  }

  let {
    fields = [],
    currentField,
    currentDirection = 'desc',
    onFieldChange = () => {},
    onDirectionToggle = () => {},
    class: className = ''
  }: Props = $props()

  let isOpen = $state(false)

  let selectedLabel = $derived(
    fields.find(f => f.value === currentField)?.label
      ?? fields[0]?.label
      ?? 'Sort by'
  )

  let resolvedField = $derived(
    fields.some(f => f.value === currentField) ? currentField : (
      (fields[0]?.value ?? '')
    )
  )

  function selectField(value: string) {
    onFieldChange(value)
    isOpen = false
  }
</script>

<div
  class={cn(
    'relative flex items-center gap-2 select-none',
    isOpen ? 'z-50' : 'z-20',
    className
  )}>
  <span class="text-xs font-medium whitespace-nowrap text-text-secondary"
    >Sort by</span>

  <DropdownTrigger
    ariaLabel="Sort by: {selectedLabel}"
    {isOpen}
    onclick={() => (isOpen = !isOpen)}>
    {selectedLabel}
  </DropdownTrigger>

  {#if isOpen}
    <button
      type="button"
      class="fixed inset-0 z-40 cursor-default"
      onclick={() => (isOpen = false)}
      aria-label="Close sort options"></button>

    <div
      role="listbox"
      aria-label="Sort field options"
      class="absolute top-[calc(100%+4px)] right-0 z-60 flex min-w-36 flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-elevated py-0 shadow-xl backdrop-blur-md">
      {#each fields as field (field.value)}
        <button
          type="button"
          role="option"
          aria-selected={field.value === resolvedField}
          onclick={() => selectField(field.value)}
          class="flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium transition-colors
            {field.value === resolvedField ?
            'bg-copilot/10 text-copilot'
          : 'text-text-primary hover:bg-surface-hover'}">
          <span>{field.label}</span>
          {#if field.value === resolvedField}
            <i
              class="bi bi-check2 shrink-0 text-copilot"
              aria-hidden="true"></i>
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  <button
    type="button"
    onclick={onDirectionToggle}
    aria-label="Sort direction: {currentDirection === 'asc' ? 'Ascending' : (
      'Descending'
    )}"
    title="Toggle sort direction"
    class="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border-subtle bg-surface-card text-text-secondary shadow-2xs transition-all hover:bg-surface-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none">
    <i
      class="bi {currentDirection === 'asc' ? 'bi-sort-up' : (
        'bi-sort-down'
      )} text-xs"
      aria-hidden="true"></i>
  </button>
</div>
