<!-- @format -->
<script lang="ts">
  import {cn} from '../../utils/cn'
  import DropdownTrigger from './DropdownTrigger.svelte'

  interface Option {
    value: string | number | null
    label: string
  }

  interface Props {
    label?: string
    placeholder?: string
    options: Option[]
    value?: string | number | null
    disabled?: boolean
    onChange?: (val: any) => void
    class?: string
  }

  let {
    label = '',
    placeholder = 'Select',
    options = [],
    value = $bindable(null),
    disabled = false,
    onChange = () => {},
    class: className = ''
  }: Props = $props()

  let isOpen = $state(false)

  let displayLabel = $derived.by(() => {
    if (value === null || value === undefined || value === '')
      return placeholder
    const valStr = String(value).trim().toLowerCase()
    const found = options.find(o => {
      if (o.value === null || o.value === undefined) return false
      return String(o.value).trim().toLowerCase() === valStr
    })
    return found?.label ?? String(value)
  })

  function select(val: any) {
    value = val
    onChange(val)
    isOpen = false
  }

  function isSelected(optValue: string | number | null): boolean {
    if (optValue === value) return true
    if (
      optValue === null
      || optValue === undefined
      || value === null
      || value === undefined
    ) {
      return optValue === value
    }
    return (
      String(optValue).trim().toLowerCase()
      === String(value).trim().toLowerCase()
    )
  }
</script>

<div
  class={cn(
    'flex items-center gap-2 select-none',
    isOpen ? 'z-50' : 'z-20',
    className
  )}>
  {#if label}
    <span class="text-xs font-medium whitespace-nowrap text-text-secondary">
      {label}
    </span>
  {/if}

  <div class="relative">
    <DropdownTrigger
      ariaLabel="{label || placeholder}: {displayLabel}"
      {options}
      {isOpen}
      {disabled}
      fullWidth={true}
      onclick={() => {
        if (!disabled) isOpen = !isOpen
      }}>
      {displayLabel}
    </DropdownTrigger>

    {#if isOpen}
      <button
        type="button"
        class="fixed inset-0 z-40 cursor-default"
        onclick={() => (isOpen = false)}
        aria-label="Close dropdown"></button>

      <div
        role="listbox"
        class="absolute top-[calc(100%+8px)] left-1/2 z-60 flex max-h-56 w-full w-max min-w-full -translate-x-1/2 flex-col rounded-sm glass-overlay p-0 shadow-xl">
        <div
          class="relative z-10 flex max-h-56 flex-col overflow-y-auto rounded-sm">
          {#each options as option (option.value)}
            <button
              type="button"
              role="option"
              aria-selected={isSelected(option.value)}
              onclick={() => select(option.value)}
              class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-medium transition-colors {(
                isSelected(option.value)
              ) ?
                'bg-copilot/10 text-copilot'
              : 'text-text-primary hover:bg-surface-hover'}">
              <span>{option.label}</span>
              {#if isSelected(option.value)}
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
</div>
