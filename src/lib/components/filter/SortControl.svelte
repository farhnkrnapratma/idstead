<script lang="ts">
  import {Check, ArrowUpNarrowWide, ArrowDownWideNarrow} from '@lucide/svelte';
  import {cn} from '../../utils/cn';
  import {buttonKey} from '$lib/shortcuts';
  import {popoverPosition} from '../../utils/popoverPosition';
  import DropdownTrigger from './DropdownTrigger.svelte';
  import IconButton from '../IconButton.svelte';

  interface SortOption {
    value: string;
    label: string;
  }

  interface Props {
    fields: SortOption[];
    currentField: string;
    currentDirection: 'asc' | 'desc';
    onFieldChange?: (field: string) => void;
    onDirectionToggle?: () => void;
    size?: 'sm' | 'md';
    labelPrefix?: string;
    fullWidth?: boolean;
    class?: string;
  }

  let {
    fields,
    currentField,
    currentDirection,
    onFieldChange,
    onDirectionToggle,
    size = 'md',
    labelPrefix = 'Sort by',
    fullWidth = false,
    class: className = ''
  }: Props = $props();

  let isOpen = $state(false);

  let currentFieldOption = $derived(
    fields.find(f => f.value === currentField) ?? fields[0]
  );

  function selectField(value: string) {
    onFieldChange?.(value);
    isOpen = false;
  }
</script>

<div
  class={cn(
    'flex items-center gap-1.5',
    fullWidth ? 'w-full' : 'w-max max-w-full',
    className
  )}>
  <div
    class={cn(
      'relative inline-block min-w-0',
      fullWidth ? 'w-full flex-1' : 'w-max max-w-full'
    )}>
    <DropdownTrigger
      {fullWidth}
      {labelPrefix}
      ariaLabel="{labelPrefix}: {currentFieldOption?.label ?? 'Select'}"
      {isOpen}
      {size}
      onclick={() => (isOpen = !isOpen)}
      options={fields}>
      {currentFieldOption?.label ?? 'Sort field'}
    </DropdownTrigger>

    {#if isOpen}
      <button
        type="button"
        class="fixed inset-0 z-30 cursor-default"
        onclick={() => (isOpen = false)}
        aria-label="Close sort menu"></button>

      <div
        role="listbox"
        aria-label="Sort options"
        use:popoverPosition={{placement: 'bottom-start', offset: 8, padding: 8}}
        class="absolute z-40 flex w-full flex-col popover-surface p-0">
        <div class="relative z-10 flex flex-col overflow-hidden rounded-md">
          {#each fields as field (field.value)}
            <button
              type="button"
              role="option"
              aria-selected={currentField === field.value}
              onclick={() => selectField(field.value)}
              class={cn(
                'flex w-full cursor-pointer items-center justify-between gap-2 text-left text-xs font-medium transition-colors',
                size === 'sm' ? 'px-2 py-1.5' : 'px-2.5 py-2',
                currentField === field.value ?
                  'bg-accent/10 font-semibold text-accent'
                : 'text-text-primary hover:bg-surface-hover hover:text-accent'
              )}>
              <span class="truncate">{field.label}</span>
              {#if currentField === field.value}
                <Check class="size-3.5 shrink-0 text-accent" />
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <IconButton
    ariaLabel="Sort direction: {currentDirection === 'asc' ? 'Ascending' : (
      'Descending'
    )}"
    tooltip={currentDirection === 'asc' ? 'Sort: Ascending' : (
      'Sort: Descending'
    )}
    size="sm"
    onclick={onDirectionToggle}
    keyboardShortcut={buttonKey('sortDirection')}
    shortcutLabel="Sort direction"
    class="shrink-0 text-text-secondary hover:text-accent">
    {#if currentDirection === 'asc'}
      <ArrowUpNarrowWide class="size-4" />
    {:else}
      <ArrowDownWideNarrow class="size-4" />
    {/if}
  </IconButton>
</div>
