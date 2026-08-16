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
    'mx-auto flex w-full flex-col font-sans leading-relaxed md:w-[80%] lg:w-[65%] xl:w-[55%]',
    className
  )}>
  {@render children?.()}
</article>
