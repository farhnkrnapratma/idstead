<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    class?: string
    children?: Snippet
  }

  let {class: className = '', children}: Props = $props()
</script>

<article
  class={cn(
    'mx-auto w-full max-w-2xl px-4 py-10 font-sans leading-relaxed sm:px-6 md:py-16',
    className
  )}
>
  {@render children?.()}
</article>
