<!-- @format -->
<script lang="ts">
  import {cn} from '../../utils/cn'
  import DropdownTrigger from './DropdownTrigger.svelte'

  interface Option {
    value: string
    label: string
  }

  interface Props {
    label: string
    options: Option[]
    value: string
    onChange?: (val: string) => void
    class?: string
  }

  let {
    label,
    options = [],
    value,
    onChange = () => {},
    class: className = ''
  }: Props = $props()

  let isOpen = $state(false)

  let displayLabel = $derived(
    options.find(o => o.value === value)?.label ?? options[0]?.label ?? label
  )

  function select(val: string) {
    onChange(val)
    isOpen = false
  }
</script>

<div
  class={cn(
    'relative inline-flex items-center gap-2 select-none',
    isOpen ? 'z-50' : 'z-20',
    className
  )}
>
  <span class="text-xs font-medium whitespace-nowrap text-text-secondary"
    >{label}</span
  >

  <DropdownTrigger
    ariaLabel="{label}: {displayLabel}"
    {isOpen}
    onclick={() => (isOpen = !isOpen)}
  >
    {displayLabel}
  </DropdownTrigger>

  {#if isOpen}
    <button
      type="button"
      class="fixed inset-0 z-40 cursor-default"
      onclick={() => (isOpen = false)}
      aria-label="Close {label} filter"
    ></button>

    <div
      role="listbox"
      aria-label="{label} options"
      class="absolute top-[calc(100%+4px)] left-0 z-60 flex min-w-36 flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-elevated py-0 shadow-xl backdrop-blur-md"
    >
      {#each options as option (option.value)}
        <button
          type="button"
          role="option"
          aria-selected={option.value === value}
          onclick={() => select(option.value)}
          class="flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium transition-colors
            {option.value === value ?
            'bg-copilot/10 text-copilot'
          : 'text-text-primary hover:bg-surface-hover'}"
        >
          <span>{option.label}</span>
          {#if option.value === value}
            <i class="bi bi-check2 shrink-0 text-copilot" aria-hidden="true"
            ></i>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
