<script lang="ts">
  import {getContext, type Snippet} from 'svelte';
  import type {HTMLInputAttributes} from 'svelte/elements';
  import type {FormFieldContext} from '../types';
  import {cn} from '../utils/cn';

  interface Props extends Omit<HTMLInputAttributes, 'size'> {
    value?: string | number;
    error?: boolean;
    valid?: boolean;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'standard' | 'floating';
    label?: string;
    required?: boolean;
    hideAsterisk?: boolean;
    fullWidth?: boolean;
    leadingIcon?: string;
    trailingIcon?: string;
    leadingSlot?: Snippet;
    trailingSlot?: Snippet;
  }

  let {
    value = $bindable(''),
    error = false,
    valid = false,
    size = 'md',
    variant,
    label = '',
    required,
    hideAsterisk,
    fullWidth = true,
    leadingIcon = '',
    trailingIcon = '',
    leadingSlot,
    trailingSlot,
    class: className = '',
    disabled = false,
    id,
    placeholder = '',
    ...restProps
  }: Props = $props();

  const sizeStyles = {
    sm: 'h-8 text-xs rounded-md px-2.5',
    md: 'h-9 text-sm rounded-md px-3',
    lg: 'h-11 text-base rounded-md px-4'
  };

  const formCtx = getContext<FormFieldContext>('formField');
  const resolvedVariant = $derived(variant ?? formCtx?.variant ?? 'standard');
  const resolvedLabel = $derived(label || formCtx?.label || '');
  const resolvedRequired = $derived(required ?? formCtx?.required ?? false);
  const resolvedHideAsterisk = $derived(
    hideAsterisk ?? formCtx?.hideAsterisk ?? false
  );
  const isFloating = $derived(resolvedVariant === 'floating');
  const hasValue = $derived(
    value !== undefined && value !== null && String(value).length > 0
  );
  const resolvedCounter = $derived(formCtx?.counter ?? '');
</script>

<div class={cn('relative flex items-center', fullWidth ? 'w-full' : '')}>
  {#if leadingIcon}
    <div
      class={cn(
        'pointer-events-none absolute left-3 z-10 flex items-center text-text-secondary',
        isFloating ? 'top-1/2 -translate-y-1/2' : ''
      )}>
      <i
        class="bi {leadingIcon} text-sm"
        aria-hidden="true"></i>
    </div>
  {:else if leadingSlot}
    <div
      class={cn(
        'pointer-events-none absolute left-2 z-10 flex items-center',
        isFloating ? 'top-1/2 -translate-y-1/2' : ''
      )}>
      {@render leadingSlot()}
    </div>
  {/if}

  <input
    {id}
    bind:value
    {disabled}
    placeholder={isFloating ? ' ' : placeholder}
    class={cn(
      'border border-border-subtle/50 bg-surface-card/85 text-text-primary shadow-2xs backdrop-blur-xs transition-colors focus:border-accent focus:bg-surface-card focus:ring-2 focus:ring-accent/20 focus:outline-none disabled:cursor-not-allowed disabled:border-border-subtle/30 disabled:bg-surface-card/20 disabled:opacity-50 disabled:backdrop-blur-none dark:border-white/10 dark:bg-surface-card/70 dark:focus:bg-surface-card/90',
      fullWidth ? 'w-full' : '',
      isFloating ?
        'peer block h-12 rounded-md px-3 pt-5! pb-1.5! text-sm leading-5 placeholder-transparent'
      : sizeStyles[size],
      isFloating ? '' : 'placeholder:text-text-secondary/70',
      leadingSlot ? 'pl-12'
      : leadingIcon ? 'pl-9'
      : '',
      trailingIcon || trailingSlot ? 'pr-9' : '',
      error ? 'border-danger! ring-danger/20!' : '',
      valid && !error ? 'border-accent! ring-accent/20!' : '',
      className
    )}
    {...restProps} />

  {#if isFloating && resolvedLabel}
    <label
      for={id}
      class={cn(
        'pointer-events-none absolute z-10 font-medium transition-all duration-200 select-none',
        'top-1/2 -translate-y-1/2 text-sm text-text-secondary/70 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-text-secondary/70',
        'peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-2xs peer-focus:leading-none peer-focus:font-semibold peer-focus:text-accent',
        'peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-2xs peer-[:not(:placeholder-shown)]:leading-none peer-[:not(:placeholder-shown)]:font-semibold peer-[:not(:placeholder-shown)]:text-text-muted',
        hasValue ?
          'top-1.5 translate-y-0 text-2xs leading-none font-semibold text-text-muted'
        : '',
        leadingSlot ? 'left-12'
        : leadingIcon ? 'left-9'
        : 'left-3',
        error ?
          'text-danger! peer-focus:text-danger! peer-[:not(:placeholder-shown)]:text-danger!'
        : ''
      )}>
      {resolvedLabel}
      {#if resolvedRequired && !resolvedHideAsterisk}
        <span
          class="text-danger"
          aria-hidden="true">*</span>
      {/if}
    </label>
  {/if}

  {#if isFloating && resolvedCounter}
    <span
      class={cn(
        'pointer-events-none absolute top-1.5 z-10 font-mono text-2xs leading-none text-text-muted select-none',
        hasValue ? 'block' : 'hidden peer-focus:block',
        trailingIcon || trailingSlot ? 'right-9' : 'right-3'
      )}>
      {resolvedCounter}
    </span>
  {/if}

  {#if trailingIcon}
    <div
      class={cn(
        'pointer-events-none absolute right-3 z-10 flex items-center text-text-secondary',
        isFloating ? 'top-1/2 -translate-y-1/2' : ''
      )}>
      <i
        class="bi {trailingIcon} text-sm"
        aria-hidden="true"></i>
    </div>
  {:else if trailingSlot}
    <div
      class={cn(
        'absolute right-2 z-10 flex items-center',
        isFloating ? 'top-1/2 -translate-y-1/2' : ''
      )}>
      {@render trailingSlot()}
    </div>
  {/if}
</div>
