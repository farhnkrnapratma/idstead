<!-- @format -->
<script lang="ts">
  import Tag from '../components/Tag.svelte'
  import {cn} from '../utils/cn'

  interface Props {
    category: string
    skills: string[]
    icon?: string
    class?: string
  }

  let {
    category,
    skills = [],
    icon = '',
    class: className = ''
  }: Props = $props()
</script>

<div
  class={cn(
    'flex flex-col gap-2.5 rounded-2xl border border-border-subtle bg-surface/50 p-4 shadow-xs transition-colors select-none sm:p-5',
    className
  )}
>
  <div
    class="flex items-center gap-2 text-xs font-bold tracking-wider text-text-secondary uppercase"
  >
    {#if icon}
      <i class="bi {icon} text-copilot" aria-hidden="true"></i>
    {/if}
    <span>{category}</span>
  </div>

  <div class="flex flex-wrap gap-1.5">
    {#each skills as skill (skill)}
      <Tag variant="neutral" size="md">{skill}</Tag>
    {/each}
  </div>
</div>
