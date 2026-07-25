<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'

  interface Props {
    title: string
    subtitle?: string
    align?: 'left' | 'center'
    actions?: Snippet
  }

  let {title, subtitle = '', align = 'left', actions}: Props = $props()
</script>

<div
  class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between {(
    align === 'center'
  ) ?
    'items-center text-center'
  : 'text-left'}">
  <div>
    <h1
      class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl lg:text-4xl">
      {title}
    </h1>
    {#if subtitle}
      <p
        class="mt-1 max-w-xl text-xs leading-relaxed text-text-secondary sm:text-sm">
        {subtitle}
      </p>
    {/if}
  </div>

  {#if actions}
    <div class="mt-3 flex shrink-0 items-center gap-2 sm:mt-0">
      {@render actions()}
    </div>
  {/if}
</div>
