<!-- @format -->
<script lang="ts">
  import Tag from '../components/Tag.svelte'
  import TagGroup from '../components/TagGroup.svelte'
  import {cn} from '../utils/cn'

  interface Props {
    role: string
    organization: string
    period: string
    location?: string
    description?: string
    highlights?: string[]
    tags?: string[]
    class?: string
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
  }: Props = $props()
</script>

<div
  class={cn(
    'relative flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface/60 p-5 shadow-xs backdrop-blur-lg transition-all select-none hover:border-border-strong hover:bg-surface-hover sm:p-6',
    className
  )}
>
  <div
    class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
  >
    <div>
      <h3 class="text-base font-bold text-text-primary">{role}</h3>
      <span class="text-xs font-semibold text-copilot">{organization}</span>
      {#if location}
        <span class="text-xs text-text-muted"> • {location}</span>
      {/if}
    </div>

    <span
      class="mt-1 inline-flex shrink-0 items-center self-start rounded-full border border-border-subtle bg-surface px-2.5 py-0.5 font-mono text-[11px] font-medium text-text-secondary sm:mt-0 sm:self-auto"
    >
      {period}
    </span>
  </div>

  {#if description}
    <p class="text-xs leading-relaxed text-text-secondary">
      {description}
    </p>
  {/if}

  {#if highlights.length > 0}
    <ul class="list-disc space-y-1 pl-4 text-xs text-text-secondary">
      {#each highlights as item (item)}
        <li>{item}</li>
      {/each}
    </ul>
  {/if}

  {#if tags.length > 0}
    <TagGroup class="mt-1 border-t border-border-subtle/40 pt-3">
      {#each tags as t (t)}
        <Tag variant="neutral" size="sm">{t}</Tag>
      {/each}
    </TagGroup>
  {/if}
</div>
