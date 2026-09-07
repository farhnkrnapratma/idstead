<script lang="ts">
  import {Calendar} from '@lucide/svelte';
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
    'flex flex-col gap-1.5 px-3.5 py-3 transition-all hover:bg-surface-hover/40 sm:gap-2 sm:px-6 sm:py-5',
    className
  )}>
  <div
    class="flex flex-col items-start gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
    <div class="min-w-0 flex-1">
      <h3 class="text-sm leading-snug font-bold text-text-primary sm:text-base">
        {role}
      </h3>
      <p class="mt-0.5 text-xs font-medium text-text-secondary">
        {organization}{#if location}
          &bull; {location}
        {/if}
      </p>
    </div>
    <span
      class="inline-flex shrink-0 items-center gap-1.5 font-sans-title text-xs leading-none font-medium text-text-muted select-none sm:mt-1 sm:self-auto">
      <Calendar
        class="size-3.5 shrink-0 text-text-muted"
        strokeWidth={1.5} />
      <span class="leading-none">{period}</span>
    </span>
  </div>

  {#if description}
    <p class="mt-1 text-xs leading-relaxed text-text-secondary">
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
