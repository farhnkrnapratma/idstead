<script lang="ts">
  import type {Snippet} from 'svelte';
  import {cn} from '../utils/cn';

  interface Props {
    ratio?: '50-50' | '60-40' | '70-30';
    class?: string;
    left?: Snippet;
    right?: Snippet;
  }

  let {ratio = '50-50', class: className = '', left, right}: Props = $props();

  const ratioStyles = {
    '50-50': 'grid-cols-1 md:grid-cols-12 gap-8',
    '60-40': 'grid-cols-1 md:grid-cols-12 gap-8',
    '70-30': 'grid-cols-1 md:grid-cols-12 gap-8'
  };

  const leftSpanStyles = {
    '50-50': 'md:col-span-6',
    '60-40': 'md:col-span-7',
    '70-30': 'md:col-span-8'
  };

  const rightSpanStyles = {
    '50-50': 'md:col-span-6',
    '60-40': 'md:col-span-5',
    '70-30': 'md:col-span-4'
  };
</script>

<div class={cn('grid w-full', ratioStyles[ratio], className)}>
  <div class={leftSpanStyles[ratio]}>
    {@render left?.()}
  </div>
  <div class={rightSpanStyles[ratio]}>
    {@render right?.()}
  </div>
</div>
