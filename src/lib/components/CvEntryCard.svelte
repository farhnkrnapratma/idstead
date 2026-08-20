<script lang="ts">
  import Tag from '../components/Tag.svelte';
  import TagGroup from '../components/TagGroup.svelte';
  import {cn} from '../utils/cn';
  import {decodeHtmlEntities} from '../utils/formatters';

  interface Props {
    role: string;
    organization: string;
    period: string;
    location?: string;
    description?: string;
    highlights?: string[];
    tags?: string[];
    class?: string;
  }

  let {
    role,
    organization,
    period,
    location = '',
    description = '',
    highlights = [],
    tags = [],
    class: className = ''
  }: Props = $props();
</script>

<div
  class={cn(
    'flex flex-col gap-2 px-6 py-5 transition-all hover:bg-surface-hover/40',
    className
  )}>
  <div class="flex items-start justify-between gap-4">
    <div>
      <h3 class="text-base font-bold text-text-primary">{role}</h3>
      <p class="text-sm font-medium text-text-secondary">
        {organization}{#if location}
          &bull; {location}
        {/if}
      </p>
    </div>
    <span
      class="shrink-0 rounded-full border border-border-subtle bg-border-subtle/30 px-2.5 py-0.5 text-xs font-semibold text-text-muted select-none">
      {period}
    </span>
  </div>

  {#if description}
    <p class="mt-1.5 text-sm leading-relaxed text-text-secondary">
      {description}
    </p>
  {/if}

  {#if highlights.length > 0}
    <ul class="mt-1.5 list-disc space-y-1 pl-4 text-xs text-text-secondary">
      {#each highlights as item (item)}
        <li>{item}</li>
      {/each}
    </ul>
  {/if}

  {#if tags.length > 0}
    <TagGroup class="mt-1.5">
      {#each tags as t (t)}
        <Tag
          variant="neutral"
          size="sm">{decodeHtmlEntities(t)}</Tag>
      {/each}
    </TagGroup>
  {/if}
</div>
