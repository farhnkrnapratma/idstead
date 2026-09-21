<script lang="ts">
  import {SquareArrowOutUpRight} from '@lucide/svelte';
  import SectionHeader from './SectionHeader.svelte';
  import EmptyState from './EmptyState.svelte';
  import BrandIcon from './BrandIcon.svelte';
  import Section from '../layout/Section.svelte';
  import PageContainer from '../layout/PageContainer.svelte';
  import {cn} from '../utils/cn';
  import {shortcut} from '../utils/shortcut.svelte';

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
    shortcutGroup,
    class: className = ''
  } = $props<{
    title: string;
    subtitle: string;
    items: GridItem[];
    emptyTitle?: string;
    emptyDescription?: string;
    shortcutGroup?: string;
    class?: string;
  }>();
</script>

<Section
  spacing="none"
  class={cn('pt-5 pb-6 md:pt-8 md:pb-8', className)}>
  <PageContainer width="standard">
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
      <div class="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {#each items as item, idx (item.href || item.label || idx)}
          <a
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            use:shortcut={{group: shortcutGroup, label: item.label}}
            class="group relative flex flex-col gap-0.5 rounded-md glass-card border border-border-subtle/60 p-2 transition-all duration-200 hover:border-accent/40 hover:bg-surface-hover hover:shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:p-3">
            <div
              class="flex flex-1 items-center justify-between gap-3 sm:flex-col sm:items-stretch">
              <div class="contents items-start justify-between gap-3 sm:flex">
                {#if item.icon}
                  <div
                    class="flex size-10 shrink-0 items-center justify-center rounded-sm bg-black/5 text-text-muted transition-colors duration-200 group-hover:border-accent/40 group-hover:bg-accent/10 group-hover:text-accent dark:bg-white/5">
                    <BrandIcon
                      icon={item.icon}
                      class="size-5 text-xl leading-none sm:size-6 sm:text-2xl" />
                  </div>
                {/if}
                <SquareArrowOutUpRight
                  class="order-last size-3 shrink-0 text-text-muted/60 transition-colors duration-200 group-hover:text-accent sm:order-none" />
              </div>
              <div class="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-none">
                <span
                  class="truncate text-sm font-semibold text-text-primary transition-colors group-hover:text-accent">
                  {item.label}
                </span>
                {#if item.value}
                  <span
                    class="truncate font-mono text-2xs text-text-muted transition-colors group-hover:text-text-secondary"
                    title={item.value}>
                    {item.value}
                  </span>
                {/if}
              </div>
            </div>
            {#if item.description}
              <span class="mt-0.5 text-2xs wrap-break-word text-text-secondary">
                {item.description}
              </span>
            {/if}
            <span class="sr-only">(opens in a new tab)</span>
          </a>
        {/each}
      </div>
    {/if}
  </PageContainer>
</Section>
