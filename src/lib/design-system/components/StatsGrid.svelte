<!-- @format -->
<script lang="ts">
  import {cn} from '../utils/cn'

  interface StatItem {
    label: string
    value: string
    description?: string
    icon?: string
  }

  interface Props {
    stats: StatItem[]
    class?: string
  }

  let {stats = [], class: className = ''}: Props = $props()
</script>

<div
  class={cn(
    'grid w-full grid-cols-2 gap-4 select-none sm:grid-cols-4',
    className
  )}
>
  {#each stats as item (item.label)}
    <div
      class="flex flex-col items-center justify-center rounded-2xl border border-border-subtle bg-surface/50 p-4 text-center shadow-xs"
    >
      {#if item.icon}
        <i class="bi {item.icon} mb-1 text-lg text-copilot" aria-hidden="true"
        ></i>
      {/if}
      <span
        class="font-mono text-2xl font-extrabold tracking-tight text-text-primary"
        >{item.value}</span
      >
      <span class="mt-0.5 text-xs font-bold text-text-secondary"
        >{item.label}</span
      >
      {#if item.description}
        <span class="mt-0.5 text-[10px] text-text-muted"
          >{item.description}</span
        >
      {/if}
    </div>
  {/each}
</div>
