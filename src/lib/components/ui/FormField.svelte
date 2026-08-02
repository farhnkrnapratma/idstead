<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'

  interface Props {
    id: string
    label: string
    required?: boolean
    error?: string
    valid?: boolean
    hint?: string
    counter?: string
    children?: Snippet
    class?: string
  }

  let {
    id,
    label,
    required = false,
    error = '',
    valid = false,
    hint = '',
    counter = '',
    children,
    class: className = ''
  }: Props = $props()
</script>

<div class="flex w-full flex-col gap-1.5 {className}">
  <div class="flex items-center justify-between">
    <label
      for={id}
      class="text-xs font-bold text-text-secondary select-none">
      {label}
      {#if required}
        <span
          class="text-danger"
          aria-hidden="true">*</span>
        <span class="sr-only">(required)</span>
      {/if}
    </label>
    {#if counter}
      <span class="font-mono text-[10px] text-text-muted select-none"
        >{counter}</span>
    {/if}
  </div>

  {@render children?.()}

  <div class="min-h-4 text-[11px] leading-tight font-medium">
    {#if error}
      <span
        role="alert"
        class="flex items-center gap-1 text-danger">
        <i
          class="bi bi-exclamation-circle-fill"
          aria-hidden="true"></i>
        {error}
      </span>
    {:else if valid}
      <span class="flex items-center gap-1 text-copilot">
        <i
          class="bi bi-check-circle-fill"
          aria-hidden="true"></i>
        Looks good
      </span>
    {:else if hint}
      <span class="text-text-muted">{hint}</span>
    {/if}
  </div>
</div>
