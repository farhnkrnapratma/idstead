<!-- @format -->
<script lang="ts">
  import EmptyState from '../EmptyState.svelte'
  import Button from '../Button.svelte'

  interface Props {
    title?: string
    description?: string
    onClearFilters?: () => void
    clearLabel?: string
    class?: string
  }

  let {
    title = 'No results found',
    description = 'No items match the selected filters or search query.',
    onClearFilters = () => {},
    clearLabel = 'Clear filters',
    class: className = ''
  }: Props = $props()
</script>

<EmptyState {title} {description} icon="bi-filter-circle" class={className}>
  {#snippet actions()}
    <Button
      variant="secondary"
      size="md"
      leadingIcon="bi-x-circle"
      onclick={onClearFilters}
    >
      {clearLabel}
    </Button>
  {/snippet}
</EmptyState>
