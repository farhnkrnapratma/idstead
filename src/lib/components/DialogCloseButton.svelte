<script lang="ts">
  import {X} from '@lucide/svelte';
  import IconButton from './IconButton.svelte';

  interface Props {
    onClose: () => void;
    ariaLabel?: string;
    tooltip?: string;
    size?: '2xs' | 'xs' | 'sm' | 'md' | 'lg';
    class?: string;
  }

  let {
    onClose,
    ariaLabel = 'Close',
    tooltip = 'Close',
    size = 'sm',
    class: className = ''
  }: Props = $props();
</script>

<IconButton
  {ariaLabel}
  {tooltip}
  variant="ghost"
  {size}
  class={className}
  onclick={onClose}>
  <X class={size === 'xs' || size === '2xs' ? 'size-3' : 'size-3.5'} />
</IconButton>
