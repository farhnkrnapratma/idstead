<script lang="ts">
  import type {Snippet} from 'svelte';
  import {cn} from '../utils/cn';

  interface Props {
    align?: 'right' | 'between' | 'center';
    class?: string;
    children?: Snippet;
  }

  let {align = 'right', class: className = '', children}: Props = $props();

  const alignStyles = {
    right: 'justify-end',
    between: 'justify-between',
    center: 'justify-center'
  };
</script>

<div class={cn('mt-6 flex items-center gap-3', alignStyles[align], className)}>
  {@render children?.()}
</div>
