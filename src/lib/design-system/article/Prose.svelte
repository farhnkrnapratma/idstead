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

<div
  class={cn(
    'prose-custom font-sans text-base leading-relaxed text-pretty text-text-primary',
    'space-y-6',
    '[&_h1]:mt-10 [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h1]:text-text-primary',
    '[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-text-primary',
    '[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-text-primary',
    '[&_p]:leading-relaxed [&_p]:text-text-primary/90',
    'transition-colors [&_a]:font-semibold [&_a]:text-copilot [&_a]:underline [&_a]:decoration-accent/40 [&_a]:underline-offset-4 [&_a:hover]:decoration-accent',
    '[&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6',
    '[&_blockquote]:border-l-2 [&_blockquote]:border-copilot/40 [&_blockquote]:pl-4 [&_blockquote]:text-text-secondary [&_blockquote]:italic',
    '[&_code]:rounded [&_code]:bg-surface-subtle [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-copilot',
    '[&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:border [&_pre]:border-border-subtle [&_pre]:bg-surface-elevated [&_pre]:p-4 [&_pre]:text-xs',
    '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-text-primary',
    '[&_hr]:my-8 [&_hr]:border-border-subtle',
    '[&_img]:rounded-2xl [&_img]:border [&_img]:border-border-subtle [&_img]:shadow-md',
    className
  )}>
  {@render children?.()}
</div>
