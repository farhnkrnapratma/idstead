<!-- @format -->
<script lang="ts">
  import Dialog from './Dialog.svelte'
  import Button from './Button.svelte'

  interface Props {
    isOpen: boolean
    title: string
    description?: string
    buttonLabel?: string
    onClose: () => void
  }

  let {
    isOpen = $bindable(false),
    title,
    description = '',
    buttonLabel = 'OK',
    onClose
  }: Props = $props()
</script>

<Dialog
  bind:isOpen
  {title}
  {description}
  size="sm"
  {onClose}>
  {#snippet footer()}
    <Button
      variant="primary"
      size="md"
      onclick={onClose}>
      {buttonLabel}
    </Button>
  {/snippet}
</Dialog>
