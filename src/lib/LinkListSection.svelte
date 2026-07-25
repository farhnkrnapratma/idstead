<!-- @format -->
<script lang="ts">
  import ListRow from './components/ui/ListRow.svelte'
  import Card from './components/ui/Card.svelte'
  import SectionHeader from './components/ui/SectionHeader.svelte'

  interface ListItem {
    label: string
    value: string
    shortValue?: string
    href: string
    icon: string
    color?: string
  }

  const {title, subtitle, items} = $props<{
    title: string
    subtitle: string
    items: ListItem[]
  }>()
</script>

<section
  class="relative z-10 mx-auto w-full px-6 pt-10 pb-24 md:w-[80%] md:max-w-none md:pt-14 md:pb-28 lg:w-[50%]">
  <SectionHeader {title} {subtitle} />

  <Card
    variant="glass"
    class="mt-8 divide-y divide-border-subtle overflow-hidden">
    {#each items as item (item.label)}
      <ListRow
        title={item.label}
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        icon={item.icon}
        iconColor={item.color || 'text-text-secondary'}>
        <span
          class="hidden truncate font-mono text-xs font-light text-text-secondary sm:inline">
          {item.value}
        </span>
        <span class="sr-only">(opens in a new tab)</span>
      </ListRow>
    {/each}
  </Card>
</section>
