<script lang="ts">
  import {Check, ArrowUpNarrowWide, ArrowDownWideNarrow} from '@lucide/svelte';
  import {cn} from '../../utils/cn';
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
    class?: string;
  }

  let {
    fields,
    currentField,
    currentDirection,
    onFieldChange,
    onDirectionToggle,
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

<div class={cn('flex items-center gap-1.5', className)}>
  <div class="relative inline-block">
    <DropdownTrigger
      ariaLabel="Sort by: {currentFieldOption?.label ?? 'Select'}"
      {isOpen}
      onclick={() => (isOpen = !isOpen)}
      options={fields}>
      <span class="inline-flex min-w-0 items-center gap-1.5 truncate">
        <span class="truncate"
          >{currentFieldOption?.label ?? 'Sort field'}</span>
      </span>
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
        class="absolute top-[calc(100%+8px)] left-0 z-40 flex w-max min-w-full flex-col rounded-sm glass-overlay p-0 shadow-xl">
        <div class="relative z-10 flex flex-col overflow-hidden rounded-sm">
          {#each fields as field (field.value)}
            <button
              type="button"
              role="option"
              aria-selected={currentField === field.value}
              onclick={() => selectField(field.value)}
              class={cn(
                'flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-xs font-medium transition-colors',
                currentField === field.value ?
                  'bg-copilot/10 font-semibold text-copilot'
                : 'text-text-primary hover:bg-surface-hover hover:text-copilot'
              )}>
              <span class="truncate">{field.label}</span>
              {#if currentField === field.value}
                <Check class="size-3.5 shrink-0 text-copilot" />
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
    class="border-border-subtle bg-surface-card text-text-secondary shadow-2xs hover:text-text-primary">
    {#if currentDirection === 'asc'}
      <ArrowUpNarrowWide class="size-4" />
    {:else}
      <ArrowDownWideNarrow class="size-4" />
    {/if}
  </IconButton>
</div>
