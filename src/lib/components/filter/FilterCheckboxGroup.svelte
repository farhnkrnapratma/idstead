<script lang="ts">
  import Checkbox from '../Checkbox.svelte';
  import Input from '../Input.svelte';
  import {cn} from '../../utils/cn';
  import DropdownTrigger from './DropdownTrigger.svelte';

  interface Option {
    value: string;
    label: string;
  }

  interface Props {
    label: string;
    options: Option[];
    selectedValues: string[];
    onChange?: (value: string) => void;
    collapsible?: boolean;
    dropdownPlacement?: 'left' | 'right';
    popoverSpan?: 'self' | '2cols-right';
    class?: string;
  }

  let {
    label,
    options = [],
    selectedValues = [],
    onChange = () => {},
    collapsible = true,
    dropdownPlacement = 'left',
    popoverSpan = 'self',
    class: className = ''
  }: Props = $props();

  let isOpen = $state(false);
  let searchQuery = $state('');

  let triggerLabel = $derived(
    selectedValues.length > 0 ? `${selectedValues.length} selected` : 'All'
  );

  let sizingOptions = $derived([
    {label: 'All'},
    {label: `${options.length} selected`}
  ]);

  let sortedOptions = $derived(
    [...options].sort((a, b) => a.label.localeCompare(b.label))
  );

  let filteredOptions = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedOptions;
    return sortedOptions.filter(
      opt =>
        opt.label.toLowerCase().includes(q)
        || opt.value.toLowerCase().includes(q)
    );
  });

  function toggleDropdown() {
    isOpen = !isOpen;
    if (isOpen) searchQuery = '';
  }
</script>

<div
  class={cn(
    'relative w-full text-left select-none sm:w-auto',
    isOpen ? 'z-50' : 'z-20',
    className
  )}>
  {#if collapsible}
    <DropdownTrigger
      ariaLabel="{label}: {triggerLabel}"
      labelPrefix={label}
      {isOpen}
      options={sizingOptions}
      onclick={toggleDropdown}>
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
        class={cn(
          'absolute top-[calc(100%+8px)] z-60 flex flex-col popover-surface p-0',
          popoverSpan === '2cols-right' ?
            'right-0 w-[calc(200%+0.625rem)] sm:inset-x-0 sm:w-full'
          : 'inset-x-0 w-full'
        )}>
        <div class="relative z-10 p-1.5 pb-1">
          <Input
            type="search"
            size="sm"
            placeholder="Search..."
            bind:value={searchQuery}
            aria-label="Search {label} options" />
        </div>
        <div
          class="relative z-10 flex max-h-52 [scrollbar-width:none] flex-col overflow-y-auto p-1.5 pt-0.5 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {#each filteredOptions as opt (opt.value)}
            <label
              class="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 font-sans-title text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover hover:text-copilot">
              <Checkbox
                checked={selectedValues.includes(opt.value)}
                onchange={() => onChange(opt.value)} />
              <span class="truncate leading-none">{opt.label}</span>
            </label>
          {:else}
            <p class="px-2 py-3 text-center text-2xs text-text-muted">
              No matches found
            </p>
          {/each}
        </div>
      </div>
    {/if}
  {:else}
    <fieldset class="flex flex-col gap-2">
      <legend
        class="mb-1 font-sans-title text-xs font-medium text-text-secondary"
        >{label}</legend>
      <div class="flex flex-wrap gap-2">
        {#each options as opt (opt.value)}
          <label
            class="flex cursor-pointer items-center gap-2 rounded-sm border border-border-subtle bg-surface-card px-2.5 py-1 font-sans-title text-xs font-medium text-text-primary hover:bg-surface-hover">
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
