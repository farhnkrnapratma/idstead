<script lang="ts">
  import ListRow from './ListRow.svelte';
  import Card from './Card.svelte';
  import SectionHeader from './SectionHeader.svelte';
  import EmptyState from './EmptyState.svelte';
  import {cn} from '../utils/cn';

  interface ListItem {
    label: string;
    value: string;
    shortValue?: string;
    href: string;
    icon?: string;
    color?: string;
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
    items: ListItem[];
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
    <Card
      variant="glass"
      class="mt-8 divide-y divide-border-subtle overflow-hidden">
      {#each items as item, idx (item.href || item.label || idx)}
        <ListRow
          title={item.label}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer">
          <span
            class="hidden truncate font-mono text-xs font-light text-text-secondary sm:inline">
            {item.value}
          </span>
          <span class="sr-only">(opens in a new tab)</span>
        </ListRow>
      {/each}
    </Card>
  {/if}
</section>
