<!-- @format -->
<script lang="ts">
  import {cn} from '../utils/cn'

  export interface BreadcrumbItem {
    label: string
    href?: string
  }

  interface Props {
    items: BreadcrumbItem[]
    maxItems?: number
    minItems?: number
    class?: string
  }

  let {
    items = [],
    maxItems = 5,
    minItems = 3,
    class: className = ''
  }: Props = $props()

  const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth']

  let processedItems = $derived.by(() => {
    if (items.length <= maxItems) {
      return items.map((item, index) => ({
        ...item,
        isCurrent: index === items.length - 1,
        displayLabel: item.label
      }))
    }

    const first = items[0]
    const last = items[items.length - 1]
    const middleItems = items
      .slice(1, -1)
      .map((item, idx) => ({
        ...item,
        isCurrent: false,
        displayLabel: ORDINALS[idx] || item.label
      }))

    return [
      {...first, isCurrent: false, displayLabel: first.label},
      ...middleItems.slice(0, maxItems - 2),
      {...last, isCurrent: true, displayLabel: last.label}
    ]
  })
</script>

{#if items.length >= minItems}
  <nav
    aria-label="Breadcrumb"
    class={cn(
      'flex flex-wrap items-center gap-1.5 font-sans text-xs select-none',
      className
    )}>
    <ol class="flex flex-wrap items-center gap-1.5">
      {#each processedItems as item, index (item.href ?? item.displayLabel)}
        <li class="inline-flex items-center gap-1.5">
          {#if index > 0}
            <i
              class="bi bi-chevron-right text-2xs text-text-muted/60"
              aria-hidden="true"></i>
          {/if}

          {#if item.isCurrent || !item.href}
            <span
              class={item.isCurrent ?
                'max-w-xs truncate font-semibold text-text-primary sm:max-w-md'
              : 'text-text-muted transition-colors hover:text-copilot'}
              aria-current={item.isCurrent ? 'page' : undefined}>
              {item.displayLabel}
            </span>
          {:else}
            <a
              href={item.href}
              class="text-text-muted transition-colors hover:text-copilot">
              {item.displayLabel}
            </a>
          {/if}
        </li>
      {/each}
    </ol>
  </nav>
{/if}
