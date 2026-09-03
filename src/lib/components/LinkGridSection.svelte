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
      class="mt-8 grid [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))] gap-3 sm:gap-4">
      {#each items as item, idx (item.href || item.label || idx)}
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          class="group relative flex flex-col gap-3 rounded-sm glass-card p-4 transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:p-5">
          <div class="flex items-center justify-between gap-2">
            {#if item.icon}
              <div
                class="flex size-10 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors group-hover:text-copilot">
                <BrandIcon
                  icon={item.icon}
                  class="text-2xl leading-none" />
              </div>
            {/if}
            <SquareArrowOutUpRight
              class="size-3.5 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-copilot" />
          </div>
          <div class="flex flex-col gap-0.5">
            <span
              class="text-xs font-semibold text-text-primary transition-colors group-hover:text-copilot sm:text-sm">
              {item.label}
            </span>
            {#if item.value}
              <span
                class="truncate font-mono text-2xs font-light text-text-secondary">
                {item.value}
              </span>
            {/if}
            {#if item.description}
              <span
                class="mt-1 line-clamp-2 text-2xs font-light text-text-secondary">
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
