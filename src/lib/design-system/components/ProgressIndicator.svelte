<!-- @format -->
<script lang="ts">
  import {cn} from '../utils/cn'

  interface Props {
    value: number
    label?: string
    class?: string
  }

  let {value = 0, label = '', class: className = ''}: Props = $props()

  const clampedValue = $derived(Math.max(0, Math.min(100, value)))
</script>

<div class={cn('flex w-full flex-col gap-1.5 select-none', className)}>
  {#if label}
    <div
      class="flex items-center justify-between text-xs font-semibold text-text-secondary"
    >
      <span>{label}</span>
      <span class="font-mono text-[11px]">{clampedValue}%</span>
    </div>
  {/if}

  <div
    role="progressbar"
    aria-valuenow={clampedValue}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-label={label || 'Progress bar'}
    class="h-2 w-full overflow-hidden rounded-full border border-border-subtle bg-surface-subtle"
  >
    <div
      class="h-full rounded-full bg-copilot transition-all duration-300"
      style="width: {clampedValue}%"
    ></div>
  </div>
</div>
