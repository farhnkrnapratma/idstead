<script lang="ts">
  import {setContext, type Snippet} from 'svelte';
  import {AlertCircle, CheckCircle2} from '@lucide/svelte';
  import type {FormFieldContext} from '../types';
  import {cn} from '../utils/cn';

  interface Props {
    id: string;
    label?: string;
    description?: string;
    required?: boolean;
    hideAsterisk?: boolean;
    error?: string;
    valid?: boolean;
    hint?: string;
    hintSnippet?: Snippet;
    counter?: string;
    maxlength?: number;
    currentLength?: number;
    variant?: 'standard' | 'floating';
    disabled?: boolean;
    children?: Snippet;
    hideFeedbackSlot?: boolean;
    class?: string;
  }

  let {
    id,
    label = '',
    description = '',
    required = false,
    hideAsterisk = false,
    error = '',
    valid = false,
    hint = '',
    hintSnippet,
    counter = '',
    maxlength,
    currentLength,
    variant = 'standard',
    disabled = false,
    children,
    hideFeedbackSlot = false,
    class: className = ''
  }: Props = $props();

  setContext<FormFieldContext>('formField', {
    get id() {
      return id;
    },
    get label() {
      return label;
    },
    get required() {
      return required;
    },
    get hideAsterisk() {
      return hideAsterisk;
    },
    get variant() {
      return variant;
    },
    get error() {
      return error;
    },
    get valid() {
      return valid;
    },
    get counter() {
      return dynamicCounter;
    }
  });

  const dynamicCounter = $derived.by(() => {
    if (counter) return counter;
    if (maxlength !== undefined && currentLength !== undefined) {
      return `${currentLength}/${maxlength}`;
    }
    return '';
  });
</script>

<div
  class={cn(
    'flex w-full flex-col gap-1',
    disabled ? 'opacity-60' : '',
    className
  )}>
  {#if variant === 'standard' && label}
    <div class="flex items-center justify-between">
      <label
        for={id}
        class="font-sans-title text-xs font-bold text-text-secondary select-none">
        {label}
        {#if required && !hideAsterisk}
          <span
            class="text-danger"
            aria-hidden="true">*</span>
          <span class="sr-only">(required)</span>
        {/if}
      </label>
      {#if dynamicCounter}
        <span class="font-mono text-2xs text-text-muted select-none"
          >{dynamicCounter}</span>
      {/if}
    </div>
  {/if}

  {#if description}
    <p class="text-xs text-text-muted select-none">{description}</p>
  {/if}

  {@render children?.()}

  {#if !hideFeedbackSlot || error || valid || hintSnippet || hint}
    <div
      class="flex min-h-3.5 items-start justify-between text-xxs leading-tight font-medium">
      <div class="min-w-0 flex-1">
        {#if error}
          <span
            id="{id}-error"
            role="alert"
            class="flex items-start gap-1.5 text-danger">
            <AlertCircle class="mt-px size-3 shrink-0 self-start" />
            <span class="min-w-0 flex-1 wrap-break-word">{error}</span>
          </span>
        {:else if valid}
          <span class="flex items-start gap-1.5 text-copilot">
            <CheckCircle2 class="mt-px size-3 shrink-0 self-start" />
            <span class="min-w-0 flex-1">Looks good</span>
          </span>
        {:else if hintSnippet}
          <span
            id="{id}-hint"
            class="text-text-muted">{@render hintSnippet()}</span>
        {:else if hint}
          <span
            id="{id}-hint"
            class="text-text-muted">{hint}</span>
        {/if}
      </div>
    </div>
  {/if}
</div>
