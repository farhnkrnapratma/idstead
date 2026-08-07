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

<header class={cn('border-b border-b-border-subtle', className)}>
  <h1
    class="font-serif text-5xl leading-tight tracking-tight text-text-primary md:text-5xl">
    {title}
  </h1>

  <div class="relative mb-3 rounded-sm bg-copilot/5 py-3 pr-2.5 pl-5">
    <div class="absolute top-0 left-0 h-full w-2 rounded-l-sm bg-copilot"></div>
    <div>
      {#if excerpt}
        <div class="text-sm leading-relaxed text-text-secondary">
          {excerpt}
        </div>
      {/if}

      {#if meta}
        <div class="mt-4">
          {@render meta()}
        </div>
      {/if}
    </div>
  </div>
</header>
