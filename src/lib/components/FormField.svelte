<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    id: string
    label: string
    description?: string
    required?: boolean
    hideAsterisk?: boolean
    error?: string
    valid?: boolean
    hint?: string
    hintSnippet?: Snippet
    counter?: string
    disabled?: boolean
    children?: Snippet
    class?: string
  }

  let {
    id,
    label,
    description = '',
    required = false,
    hideAsterisk = false,
    error = '',
    valid = false,
    hint = '',
    hintSnippet,
    counter = '',
    disabled = false,
    children,
    class: className = ''
  }: Props = $props()
</script>

<div
  class={cn(
    'flex w-full flex-col gap-1.5',
    disabled ? 'opacity-60' : '',
    className
  )}>
  <div class="flex items-center justify-between">
    <label
      for={id}
      class="text-xs font-bold text-text-secondary select-none">
      {label}
      {#if required && !hideAsterisk}
        <span
          class="text-danger"
          aria-hidden="true">*</span>
        <span class="sr-only">(required)</span>
      {/if}
    </label>
    {#if counter}
      <span class="font-mono text-2xs text-text-muted select-none"
        >{counter}</span>
    {/if}
  </div>

  {#if description}
    <p class="text-xs text-text-muted select-none">{description}</p>
  {/if}

  {@render children?.()}

  <div class="min-h-4 text-xxs leading-tight font-medium">
    {#if error}
      <span
        id="{id}-error"
        role="alert"
        class="flex items-start gap-1.5 text-danger">
        <i
          class="bi bi-exclamation-circle-fill mt-px shrink-0 self-start text-xs leading-none"
          aria-hidden="true"></i>
        <span class="min-w-0 flex-1 wrap-break-word">{error}</span>
      </span>
    {:else if valid}
      <span class="flex items-start gap-1.5 text-copilot">
        <i
          class="bi bi-check-circle-fill mt-px shrink-0 self-start text-xs leading-none"
          aria-hidden="true"></i>
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
