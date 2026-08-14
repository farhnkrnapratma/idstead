<!-- @format -->
<script lang="ts">
  import IconButton from './IconButton.svelte'

  interface Props {
    onClose: () => void
    class?: string
  }

  let {onClose, class: className = ''}: Props = $props()
</script>

<IconButton
  ariaLabel="Close dialog"
  variant="ghost"
  size="sm"
  class={className}
  onclick={onClose}>
  <i
    class="bi bi-x-lg text-xs"
    aria-hidden="true"></i>
</IconButton>
