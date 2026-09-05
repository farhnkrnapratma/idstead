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
    'flex flex-col gap-1.5 rounded-md glass-card p-3 transition-colors select-none sm:gap-2 sm:p-4',
    className
  )}>
  <div
    class="flex items-center gap-2 text-2xs font-bold tracking-wider text-text-secondary uppercase sm:text-xs">
    {#if icon}
      <i
        class="bi {icon} text-accent"
        aria-hidden="true"></i>
    {/if}
    <span>{category}</span>
  </div>

  <div class="flex flex-wrap gap-1.5">
    {#each skills as skill (skill)}
      <Tag
        variant="subtle"
        size="sm">{decodeHtmlEntities(skill)}</Tag>
    {/each}
  </div>
</div>
