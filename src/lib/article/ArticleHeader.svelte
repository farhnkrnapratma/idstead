<script lang="ts">
  import type {Snippet} from 'svelte';
  import {cn} from '../utils/cn';
  import {contentFontStore} from '../stores/contentFontStore.svelte';

  interface Props {
    title: string;
    excerpt?: string;
    class?: string;
    titleClass?: string;
    meta?: Snippet;
  }

  let {
    title,
    excerpt = '',
    class: className = '',
    titleClass = '',
    meta
  }: Props = $props();
</script>

<header class={cn('border-b border-b-border-subtle pb-4', className)}>
  <h1
    class={cn(
      'font-content-' + contentFontStore.current,
      'text-3xl leading-tight font-bold tracking-tight text-text-secondary md:text-4xl',
      titleClass
    )}>
    {title}
  </h1>

  {#if excerpt}
    <p
      class={cn(
        'font-content-' + contentFontStore.current,
        'mt-2 text-base text-text-muted'
      )}>
      {excerpt}
    </p>
  {/if}

  {#if meta}
    <div class="mt-3">
      {@render meta()}
    </div>
  {/if}
</header>
