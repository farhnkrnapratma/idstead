<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'
  import {cn} from '../utils/cn'

  interface Props {
    title: string
    excerpt?: string
    class?: string
    titleViewTransitionName?: string
    meta?: Snippet
  }

  let {
    title,
    excerpt = '',
    class: className = '',
    titleViewTransitionName = '',
    meta
  }: Props = $props()
</script>

<header class={cn('border-b border-b-border-subtle pb-4', className)}>
  <!-- @format -->
  <h1
    style={titleViewTransitionName ?
      `view-transition-name: ${titleViewTransitionName}`
    : undefined}
    class="font-sans text-3xl leading-tight font-bold tracking-tight text-text-primary md:text-4xl">
    {title}
  </h1>

  {#if meta}
    <div class="mt-3">
      {@render meta()}
    </div>
  {/if}
</header>
