<script lang="ts">
  import {cn} from '../utils/cn';

  interface Props {
    message?: string;
    politeness?: 'polite' | 'assertive';
    class?: string;
  }

  let {
    message = '',
    politeness = 'polite',
    class: className = ''
  }: Props = $props();
</script>

<div
  role="status"
  aria-live={politeness}
  aria-atomic="true"
  class={cn('sr-only', className)}>
  {message}
</div>
