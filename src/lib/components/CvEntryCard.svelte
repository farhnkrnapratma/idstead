<script lang="ts">
  import {Calendar, MapPin, BuildingComplex} from '@lucide/svelte';
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
    location,
    description,
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
  <div class="block sm:inline-flex sm:justify-between">
    <h3
      class="mb-1.5 text-base font-semibold text-text-primary sm:mb-0 sm:text-lg sm:leading-none">
      {role}
    </h3>
    <div
      class="flex shrink-0 items-center gap-1.5 text-2xs leading-none font-medium text-text-muted select-none sm:mt-1 sm:self-auto sm:text-xs">
      <Calendar
        class="size-3 shrink-0 text-text-muted sm:size-3.5"
        strokeWidth={1.5} />
      <span class="leading-none">{period}</span>
    </div>
  </div>
  <div class="flex flex-col gap-1.5">
    <div
      class="flex shrink-0 items-center gap-1.5 text-2xs leading-none font-medium text-text-muted select-none sm:mt-1 sm:self-auto sm:text-xs">
      <BuildingComplex
        class="size-3 shrink-0 text-text-muted sm:size-3.5"
        strokeWidth={1.5} />
      <span class="leading-none">{organization}</span>
    </div>
    {#if location}
      <div
        class="flex shrink-0 items-center gap-1.5 text-2xs leading-none font-medium text-text-muted select-none sm:mt-1 sm:self-auto sm:text-xs">
        <MapPin
          class="size-3 shrink-0 text-text-muted sm:size-3.5"
          strokeWidth={1.5} />
        <span class="leading-none">{location}</span>
      </div>
    {/if}
  </div>

  {#if description}
    <p
      class="mt-1 border-t border-t-border-subtle/60 pt-2 text-xs leading-relaxed text-text-secondary sm:text-sm">
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
