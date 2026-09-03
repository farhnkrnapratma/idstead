<script lang="ts">
  import Tag from '../components/Tag.svelte';
  import {cn} from '../utils/cn';
  import {decodeHtmlEntities} from '../utils/formatters';

  interface Props {
    category: string;
    skills: string[];
    icon?: string;
    class?: string;
  }

  let {
    category,
    skills = [],
    icon = '',
    class: className = ''
  }: Props = $props();
</script>

<div
  class={cn(
    'flex flex-col gap-2.5 rounded-sm glass-card p-4 transition-colors select-none sm:p-5',
    className
  )}>
  <div
    class="flex items-center gap-2 text-xs font-bold tracking-wider text-text-secondary uppercase">
    {#if icon}
      <i
        class="bi {icon} text-copilot"
        aria-hidden="true"></i>
    {/if}
    <span>{category}</span>
  </div>

  <div class="flex flex-wrap gap-1.5">
    {#each skills as skill (skill)}
      <Tag
        variant="subtle"
        size="md">{decodeHtmlEntities(skill)}</Tag>
    {/each}
  </div>
</div>
