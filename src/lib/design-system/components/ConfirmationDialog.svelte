<!-- @format -->
<script lang="ts">
  import Dialog from './Dialog.svelte'
  import Button from './Button.svelte'

  interface Props {
    isOpen: boolean
    title: string
    message?: string
    confirmLabel?: string
    cancelLabel?: string
    isDestructive?: boolean
    onConfirm?: () => void
    onCancel?: () => void
    children?: import('svelte').Snippet
  }

  let {
    isOpen = $bindable(false),
    title,
    message = '',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    isDestructive = false,
    onConfirm = () => {},
    onCancel = () => {},
    children
  }: Props = $props()

  function close() {
    isOpen = false
    onCancel()
  }

  function confirm() {
    isOpen = false
    onConfirm()
  }
</script>

<Dialog
  bind:isOpen
  {title}
  description={message}
  onClose={close}>
  {#if children}
    {@render children()}
  {/if}
  {#snippet footer()}
    <Button
      variant="secondary"
      size="md"
      onclick={close}>
      <span class="inline-flex items-center gap-1.5">
        <span>{cancelLabel}</span>
        <kbd
          class="hidden items-center rounded border border-border-subtle/80 bg-surface-elevated/80 px-1 py-0.5 font-mono text-[9px] leading-none text-text-muted select-none sm:inline-flex">
          Esc
        </kbd>
      </span>
    </Button>
    <Button
      variant={isDestructive ? 'destructive' : 'primary'}
      size="md"
      onclick={confirm}>
      {confirmLabel || (isDestructive ? 'Delete' : 'Confirm')}
    </Button>
  {/snippet}
</Dialog>
