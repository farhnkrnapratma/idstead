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

  <div class="relative">
    <DropdownTrigger
      ariaLabel="Sort by: {selectedLabel}"
      options={fields}
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
        class="absolute top-[calc(100%+8px)] left-1/2 z-60 flex w-full w-max min-w-full -translate-x-1/2 flex-col rounded-sm glass-overlay p-0 shadow-xl">
        <div class="relative z-10 flex flex-col overflow-hidden rounded-sm">
          {#each fields as field (field.value)}
            <button
              type="button"
              role="option"
              aria-selected={field.value === resolvedField}
              onclick={() => selectField(field.value)}
              class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-medium transition-colors {(
                field.value === resolvedField
              ) ?
                'bg-copilot/10 text-copilot'
              : 'text-text-primary hover:bg-surface-hover'}">
              <span>{field.label}</span>
              {#if field.value === resolvedField}
                <i
                  class="bi bi-check2 shrink-0 text-sm text-copilot"
                  aria-hidden="true"></i>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <button
    type="button"
    onclick={onDirectionToggle}
    aria-label="Sort direction: {currentDirection === 'asc' ? 'Ascending' : (
      'Descending'
    )}"
    title="Toggle sort direction"
    class="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-sm glass-card text-text-secondary shadow-2xs transition-all hover:text-text-primary focus-visible:ring-2 focus-visible:ring-copilot focus-visible:outline-none">
    <i
      class="bi {currentDirection === 'asc' ? 'bi-sort-up' : (
        'bi-sort-down'
      )} text-xs"
      aria-hidden="true"></i>
  </button>
</div>
