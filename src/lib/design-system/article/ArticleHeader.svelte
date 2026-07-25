<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    title: string
    excerpt?: string
    class?: string
    meta?: Snippet
  }

  let {title, excerpt = '', class: className = '', meta}: Props = $props()
</script>

<header
  class={cn(
    'mb-10 flex flex-col gap-4 border-b border-border-subtle pb-8 select-none',
    className
  )}>
  <h1
    class="text-3xl leading-[1.15] font-extrabold tracking-tight text-text-primary sm:text-4xl lg:text-5xl">
    {title}
  </h1>

  {#if excerpt}
    <p
      class="text-base leading-relaxed font-normal text-text-secondary sm:text-lg">
      {excerpt}
    </p>
  {/if}

  {#if meta}
    <div class="mt-2 text-xs text-text-muted">
      {@render meta()}
    </div>
  {/if}
</header>
