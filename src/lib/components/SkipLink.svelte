<script lang="ts">
  import {cn} from '../utils/cn';

  interface Props {
    targetId?: string;
    label?: string;
    class?: string;
    variant?: 'default' | 'search-overlay';
  }

  let {
    targetId = 'main-content',
    label = 'Skip to main content',
    class: className = '',
    variant = 'default'
  }: Props = $props();
</script>

<a
  href={`#${targetId}`}
  class={cn(
    'sr-only transition-all focus:not-sr-only focus:z-20 focus:rounded-md focus:bg-accent focus:font-semibold focus:text-text-on-accent focus:shadow-sm focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring',
    variant === 'search-overlay' ?
      'focus:absolute focus:top-0 focus:bottom-0 focus:left-0 focus:flex focus:h-full focus:w-max focus:min-w-full focus:items-center focus:justify-center focus:px-3 focus:text-xs lg:focus:inset-0 lg:focus:w-full'
    : 'focus:fixed focus:top-4 focus:left-4 focus:px-4 focus:py-2.5 focus:text-xs focus:font-bold focus:shadow-2xl',
    className
  )}>
  {label}
</a>
