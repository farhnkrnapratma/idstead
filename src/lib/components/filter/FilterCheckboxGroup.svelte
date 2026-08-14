<!-- @format -->
<script lang="ts">
  import Checkbox from '../Checkbox.svelte'
  import {cn} from '../../utils/cn'
  import DropdownTrigger from './DropdownTrigger.svelte'

  interface Option {
    value: string
    label: string
  }

  interface Props {
    label: string
    options: Option[]
    selectedValues: string[]
    onChange?: (value: string) => void
    collapsible?: boolean
    class?: string
  }

  let {
    label,
    options = [],
    selectedValues = [],
    onChange = () => {},
    collapsible = true,
    class: className = ''
  }: Props = $props()

  let isOpen = $state(false)

  let triggerLabel = $derived(
    selectedValues.length > 0 ? `${selectedValues.length} selected` : 'All'
  )
</script>

<div
  class={cn(
    'inline-flex items-center gap-2 text-left select-none',
    isOpen ? 'z-50' : 'z-20',
    className
  )}>
  <span class="text-xs font-medium whitespace-nowrap text-text-secondary"
    >{label}</span>

  {#if collapsible}
    <div class="relative">
      <DropdownTrigger
        ariaLabel="{label}: {triggerLabel}"
        {isOpen}
        {options}
        onclick={() => (isOpen = !isOpen)}>
        {triggerLabel}
      </DropdownTrigger>

      {#if isOpen}
        <button
          type="button"
          class="fixed inset-0 z-40 cursor-default"
          onclick={() => (isOpen = false)}
          aria-label="Close {label} filter"></button>

        <div
          role="group"
          aria-label="{label} filters"
          class="absolute top-[calc(100%+8px)] left-1/2 z-60 flex w-full w-max min-w-full -translate-x-1/2 flex-col rounded-sm glass-overlay p-0 shadow-xl">
          <div
            class="relative z-10 flex max-h-52 [scrollbar-width:none] flex-col overflow-y-auto p-1.5 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {#each options as opt (opt.value)}
              <label
                class="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover/70">
                <Checkbox
                  checked={selectedValues.includes(opt.value)}
                  onchange={() => onChange(opt.value)} />
                <span class="leading-none">{opt.label}</span>
              </label>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <fieldset class="flex flex-col gap-2">
      <legend class="mb-1 text-xs font-medium text-text-secondary"
        >{label}</legend>
      <div class="flex flex-wrap gap-2">
        {#each options as opt (opt.value)}
          <label
            class="flex cursor-pointer items-center gap-2 rounded-sm border border-border-subtle bg-surface-card px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-surface-hover">
            <Checkbox
              checked={selectedValues.includes(opt.value)}
              onchange={() => onChange(opt.value)} />
            <span>{opt.label}</span>
          </label>
        {/each}
      </div>
    </fieldset>
  {/if}
</div>
