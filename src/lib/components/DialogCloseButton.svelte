<script lang="ts">
  import {X} from '@lucide/svelte'
  import IconButton from './IconButton.svelte'

  interface Props {
    onClose: () => void
    class?: string
  }

  let {onClose, class: className = ''}: Props = $props()
</script>

<IconButton
  ariaLabel="Close"
  tooltip="Close"
  variant="ghost"
  size="sm"
  class={className}
  onclick={onClose}>
  <X class="size-3.5" />
</IconButton>
