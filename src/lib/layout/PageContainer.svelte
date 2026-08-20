<script lang="ts">
  import type {Snippet} from 'svelte';
  import {cn} from '../utils/cn';

  interface Props {
    width?:
      'reading' | 'standard' | 'listing' | 'admin' | 'form' | 'editor' | 'full';
    as?: string;
    class?: string;
    children?: Snippet;
  }

  let {
    width = 'standard',
    as = 'div',
    class: className = '',
    children
  }: Props = $props();

  const widthStyles = {
    reading: 'w-full md:w-[80%] lg:w-[65%] xl:w-[55%]',
    form: 'max-w-xl',
    editor: 'max-w-4xl',
    standard: 'w-full md:w-[80%] lg:w-[65%] xl:w-[55%]',
    listing: 'w-full md:w-[80%] lg:w-[65%] xl:w-[55%]',
    admin: 'w-full max-w-7xl',
    full: 'max-w-7xl'
  };
</script>

<svelte:element
  this={as}
  class={cn('mx-auto w-full px-6', widthStyles[width], className)}>
  {@render children?.()}
</svelte:element>
