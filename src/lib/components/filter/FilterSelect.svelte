<script lang="ts">
  import {Check} from '@lucide/svelte';
  import {cn} from '../../utils/cn';
  import {popoverPosition} from '../../utils/popoverPosition';
  import DropdownTrigger from './DropdownTrigger.svelte';

  interface Option {
    value: string;
    label: string;
  }

  interface Props {
    label: string;
    options: Option[];
    value: string;
    onChange?: (val: string) => void;
    dropdownPlacement?: 'left' | 'right';
    popoverSpan?: 'self' | '2cols-left';
    class?: string;
  }

  let {
    label,
    options = [],
    value,
    onChange = () => {},
    dropdownPlacement = 'left',
    popoverSpan = 'self',
    class: className = ''
  }: Props = $props();

  let isOpen = $state(false);

  let displayLabel = $derived(
    options.find(o => o.value === value)?.label ?? options[0]?.label ?? label
  );

  function select(val: string) {
    onChange(val);
    isOpen = false;
  }
</script>

<div
  class={cn(
    'relative w-full select-none sm:w-auto',
    isOpen ? 'z-50' : 'z-20',
    className
  )}>
  <DropdownTrigger
    ariaLabel="{label}: {displayLabel}"
    labelPrefix={label}
    {options}
    {isOpen}
    onclick={() => (isOpen = !isOpen)}>
    {displayLabel}
  </DropdownTrigger>

  {#if isOpen}
    <button
      type="button"
      class="fixed inset-0 z-40 cursor-default"
      onclick={() => (isOpen = false)}
      aria-label="Close {label} filter"></button>

    <div
      role="listbox"
      aria-label="{label} options"
      use:popoverPosition={{
        placement:
          dropdownPlacement === 'right' ? 'bottom-end' : 'bottom-start',
        offset: 8,
        padding: 8
      }}
      class={cn(
        'absolute z-60 flex flex-col popover-surface p-0',
        popoverSpan === '2cols-left' ?
          'w-[calc(200%+0.625rem)] sm:w-full'
        : 'w-full'
      )}>
      <div class="relative z-10 flex flex-col overflow-hidden rounded-md">
        {#each options as option (option.value)}
          <button
            type="button"
            role="option"
            aria-selected={option.value === value}
            onclick={() => select(option.value)}
            class={cn(
              'flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-xs font-medium transition-colors',
              option.value === value ?
                'bg-accent/10 font-semibold text-accent'
              : 'text-text-primary hover:bg-surface-hover hover:text-accent'
            )}>
            <span class="truncate">{option.label}</span>
            {#if option.value === value}
              <Check class="size-3.5 shrink-0 text-accent" />
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
