<script lang="ts">
  import {getContext} from 'svelte';
  import {Check} from '@lucide/svelte';
  import type {FormFieldContext} from '../../types';
  import {cn} from '../../utils/cn';
  import {popoverPosition} from '../../utils/popoverPosition';
  import DropdownTrigger from './DropdownTrigger.svelte';

  interface Option {
    value: string | number | boolean | null;
    label: string;
    shortLabel?: string;
  }

  interface Props {
    id?: string;
    label?: string;
    placeholder?: string;
    options: Option[];
    value?: any;
    variant?: 'standard' | 'floating';
    size?: 'sm' | 'md';
    fullWidth?: boolean;
    dropdownPlacement?: 'left' | 'right';
    menuWidth?: string;
    ariaLabel?: string;
    required?: boolean;
    hideAsterisk?: boolean;
    disabled?: boolean;
    onChange?: (val: any) => void;
    class?: string;
  }

  let {
    id,
    label = '',
    placeholder = 'Select',
    options = [],
    value = $bindable(null),
    variant,
    size = 'md',
    fullWidth = true,
    dropdownPlacement = 'left',
    menuWidth = '',
    ariaLabel,
    required,
    hideAsterisk,
    disabled = false,
    onChange = () => {},
    class: className = ''
  }: Props = $props();

  let isOpen = $state(false);

  const formCtx = getContext<FormFieldContext>('formField');
  const resolvedVariant = $derived(variant ?? formCtx?.variant ?? 'standard');
  const resolvedLabel = $derived(label || formCtx?.label || '');
  const resolvedRequired = $derived(required ?? formCtx?.required ?? false);
  const resolvedHideAsterisk = $derived(
    hideAsterisk ?? formCtx?.hideAsterisk ?? false
  );
  const isFloating = $derived(resolvedVariant === 'floating');
  const hasValue = $derived(
    value !== null && value !== undefined && value !== ''
  );

  function isSelected(optValue: any): boolean {
    if (optValue === value) return true;
    if (
      optValue === null
      || optValue === undefined
      || value === null
      || value === undefined
    ) {
      return optValue === value;
    }
    return (
      String(optValue).trim().toLowerCase()
      === String(value).trim().toLowerCase()
    );
  }

  const selectedOption = $derived(options.find(o => isSelected(o.value)));

  let displayLabel = $derived.by(() => {
    if (value === null || value === undefined || value === '')
      return placeholder;
    return selectedOption?.label ?? String(value);
  });

  function select(val: any) {
    value = val;
    onChange(val);
    isOpen = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      isOpen = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class={cn(
    'relative select-none',
    fullWidth ? 'w-full' : 'inline-block',
    isOpen ? 'z-50' : 'z-20',
    className
  )}>
  {#if !isFloating && label}
    <span
      class="mb-1 block text-xs font-medium whitespace-nowrap text-text-secondary">
      {label}
    </span>
  {/if}

  <div class={cn('relative', fullWidth ? 'w-full' : 'inline-block')}>
    <DropdownTrigger
      ariaLabel={ariaLabel
        || `${resolvedLabel || placeholder}: ${displayLabel}`}
      {options}
      {isOpen}
      {disabled}
      {size}
      {fullWidth}
      class={isFloating ? 'h-12 pt-5! pb-1.5! text-sm leading-5' : ''}
      hideChevron={isFloating && !hasValue && !isOpen}
      onclick={() => {
        if (!disabled) isOpen = !isOpen;
      }}>
      <span
        class={cn(
          isFloating && !hasValue && !isOpen ? 'text-transparent' : ''
        )}>
        {#if selectedOption?.shortLabel}
          <span class="sm:hidden">{selectedOption.shortLabel}</span>
          <span class="hidden sm:inline">{selectedOption.label}</span>
        {:else}
          {displayLabel}
        {/if}
      </span>
    </DropdownTrigger>

    {#if isFloating && resolvedLabel}
      <label
        for={id}
        class={cn(
          'pointer-events-none absolute left-3 z-10 font-medium transition-all duration-200 select-none',
          hasValue || isOpen ?
            'top-1.5 text-2xs leading-none font-semibold'
          : 'top-1/2 -translate-y-1/2 text-sm text-text-secondary/70',
          isOpen ? 'text-accent!'
          : hasValue ? 'text-text-muted'
          : 'text-text-secondary/70'
        )}>
        {resolvedLabel}
        {#if resolvedRequired && !resolvedHideAsterisk}
          <span
            class="text-danger"
            aria-hidden="true">*</span>
        {/if}
      </label>
    {/if}

    {#if isOpen}
      <button
        type="button"
        class="fixed inset-0 z-40 cursor-default"
        onclick={() => (isOpen = false)}
        aria-label="Close dropdown"></button>

      <div
        role="listbox"
        use:popoverPosition={{
          placement:
            dropdownPlacement === 'right' ? 'bottom-end' : 'bottom-start',
          offset: 8,
          padding: 8
        }}
        class={cn(
          'absolute z-60 flex max-h-56 flex-col popover-surface p-0',
          fullWidth ? 'inset-x-0 w-full' : 'w-full',
          menuWidth
        )}>
        <div
          class="relative z-10 flex max-h-56 flex-col overflow-y-auto rounded-md">
          {#each options as option (option.value)}
            <button
              type="button"
              role="option"
              aria-selected={isSelected(option.value)}
              onclick={() => select(option.value)}
              class={cn(
                'flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-xs font-medium transition-colors',
                isSelected(option.value) ?
                  'bg-accent/10 font-semibold text-accent'
                : 'text-text-primary hover:bg-surface-hover hover:text-accent'
              )}>
              <span class="truncate">{option.label}</span>
              {#if isSelected(option.value)}
                <Check class="size-3.5 shrink-0 text-accent" />
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>
