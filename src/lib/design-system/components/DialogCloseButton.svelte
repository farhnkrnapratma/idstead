<!-- @format -->
<script lang="ts">
  import IconButton from './IconButton.svelte'

  interface Props {
    onClose: () => void
  }

  let {onClose}: Props = $props()
</script>

<IconButton
  ariaLabel="Close dialog"
  variant="ghost"
  size="sm"
  onclick={onClose}>
  <i class="bi bi-x-lg text-xs" aria-hidden="true"></i>
</IconButton>
