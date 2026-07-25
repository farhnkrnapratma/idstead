<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    width?: 'reading' | 'standard' | 'listing' | 'admin' | 'form' | 'full'
    class?: string
    children?: Snippet
  }

  let {width = 'standard', class: className = '', children}: Props = $props()

  const widthStyles = {
    reading: 'max-w-2xl',
    form: 'max-w-xl',
    standard: 'w-full md:w-[80%] lg:w-[50%]',
    listing: 'w-full md:w-[80%] lg:w-[50%]',
    admin: 'w-full md:w-[80%] lg:w-[50%]',
    full: 'max-w-7xl'
  }
</script>

<div class={cn('mx-auto w-full px-4 sm:px-6', widthStyles[width], className)}>
  {@render children?.()}
</div>
