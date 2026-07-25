<!-- @format -->
<script lang="ts">
  import type {Snippet} from 'svelte'

  interface Props {
    align?: 'left' | 'center' | 'right' | 'between'
    gap?: 'sm' | 'md' | 'lg'
    children?: Snippet
    class?: string
  }

  let {
    align = 'right',
    gap = 'md',
    children,
    class: className = ''
  }: Props = $props()

  const alignStyles = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between'
  }

  const gapStyles = {sm: 'gap-2', md: 'gap-3', lg: 'gap-4'}
</script>

<div
  class="flex flex-wrap items-center {alignStyles[align]} {gapStyles[
    gap
  ]} {className}">
  {@render children?.()}
</div>
