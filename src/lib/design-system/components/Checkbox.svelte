<!-- @format -->
<script lang="ts">
  import type {HTMLInputAttributes} from 'svelte/elements'
  import {cn} from '../utils/cn'

  interface Props extends Omit<HTMLInputAttributes, 'type'> {
    checked?: boolean
    label?: string
    description?: string
  }

  let {
    checked = $bindable(false),
    label = '',
    description = '',
    id,
    disabled = false,
    class: className = '',
    ...restProps
  }: Props = $props()
</script>

<label
  class={cn(
    'inline-flex cursor-pointer items-start gap-2.5 select-none',
    disabled ? 'cursor-not-allowed opacity-50' : '',
    className
  )}
>
  <input
    type="checkbox"
    {id}
    {disabled}
    bind:checked
    class="mt-0.5 h-3.5 w-3.5 cursor-pointer rounded border-border-default bg-surface text-copilot accent-copilot transition-colors focus:ring-2 focus:ring-copilot/20 focus:ring-offset-0 focus:outline-none"
    {...restProps}
  />
  {#if label || description}
    <div class="flex flex-col">
      {#if label}
        <span class="text-xs font-semibold text-text-primary sm:text-sm"
          >{label}</span
        >
      {/if}
      {#if description}
        <span class="mt-0.5 text-xs text-text-muted">{description}</span>
      {/if}
    </div>
  {/if}
</label>
