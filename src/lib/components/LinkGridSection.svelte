<script lang="ts">
  import {SquareArrowOutUpRight} from '@lucide/svelte';
  import SectionHeader from './SectionHeader.svelte';
  import EmptyState from './EmptyState.svelte';
  import BrandIcon from './BrandIcon.svelte';
  import {cn} from '../utils/cn';

  interface GridItem {
    label: string;
    value: string;
    href: string;
    icon?: string;
    color?: string;
    description?: string;
  }

  const {
    title,
    subtitle,
    items,
    emptyTitle = 'Nothing here yet',
    emptyDescription = 'Check back soon.',
    class: className = ''
  } = $props<{
    title: string;
    subtitle: string;
    items: GridItem[];
    emptyTitle?: string;
    emptyDescription?: string;
    class?: string;
  }>();
</script>

<section
  class={cn(
    'relative z-10 mx-auto w-full px-6 pt-10 pb-6 md:w-[80%] md:max-w-none md:pt-14 md:pb-8 lg:w-[65%] xl:w-[55%]',
    className
  )}>
  <SectionHeader
    {title}
    {subtitle} />

  {#if items.length === 0}
    <div class="mt-8">
      <EmptyState
        title={emptyTitle}
        description={emptyDescription} />
    </div>
  {:else}
    <div
      class="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-3">
      {#each items as item, idx (item.href || item.label || idx)}
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          class="group relative flex flex-col justify-between gap-3.5 rounded-sm glass-card border border-border-subtle/60 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-copilot/40 hover:bg-surface-hover hover:shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:p-4">
          <div class="flex items-start justify-between gap-3">
            {#if item.icon}
              <div
                class="flex size-10 shrink-0 items-center justify-center rounded-sm border border-border-subtle/70 bg-black/5 text-text-muted transition-colors duration-200 group-hover:border-copilot/40 group-hover:bg-copilot/10 group-hover:text-copilot dark:bg-white/5">
                <BrandIcon
                  icon={item.icon}
                  class="size-5.5 text-xl leading-none sm:size-6 sm:text-2xl" />
              </div>
            {/if}
            <SquareArrowOutUpRight
              class="size-3.5 shrink-0 text-text-muted/60 transition-colors duration-200 group-hover:text-copilot" />
          </div>
          <div class="flex min-w-0 flex-col gap-0.5">
            <span
              class="truncate font-sans-title text-xs font-semibold text-text-primary transition-colors group-hover:text-copilot sm:text-sm">
              {item.label}
            </span>
            {#if item.value}
              <span
                class="truncate font-mono text-2xs text-text-muted transition-colors group-hover:text-text-secondary"
                title={item.value}>
                {item.value}
              </span>
            {/if}
            {#if item.description}
              <span
                class="mt-0.5 line-clamp-2 text-2xs font-light text-text-secondary">
                {item.description}
              </span>
            {/if}
          </div>
          <span class="sr-only">(opens in a new tab)</span>
        </a>
      {/each}
    </div>
  {/if}
</section>
