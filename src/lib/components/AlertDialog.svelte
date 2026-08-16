<script lang="ts">
  import Dialog from './Dialog.svelte'
  import Button from './Button.svelte'

  interface Props {
    isOpen: boolean
    title: string
    description?: string
    buttonLabel?: string
    onClose: () => void
    class?: string
  }

  let {
    isOpen = $bindable(false),
    title,
    description = '',
    buttonLabel = 'OK',
    onClose,
    class: className = ''
  }: Props = $props()
</script>

<Dialog
  bind:isOpen
  {title}
  {description}
  size="sm"
  class={className}
  {onClose}>
  {#snippet footer()}
    <Button
      type="primary"
      size="md"
      onclick={onClose}>
      {buttonLabel}
    </Button>
  {/snippet}
</Dialog>
