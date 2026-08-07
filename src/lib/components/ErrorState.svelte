<!-- @format -->
<script lang="ts">
  import Button from './Button.svelte'
  import ShinyText from './ShinyText.svelte'
  import {cn} from '../utils/cn'
  import type {Snippet} from 'svelte'

  interface Props {
    title?: string
    description?: string
    icon?: string
    code?: string | number
    size?: 'inline' | 'page'
    onRetry?: () => void
    retryLabel?: string
    actions?: Snippet
    class?: string
  }

  let {
    title = 'Something went wrong',
    description = 'We encountered an unexpected error while loading this content.',
    icon = 'bi-exclamation-triangle',
    code,
    size = 'inline',
    onRetry,
    retryLabel = 'Try Again',
    actions,
    class: className = ''
  }: Props = $props()
</script>

{#if size === 'page'}
  <div
    role="alert"
    aria-live="assertive"
    class={cn(
      'flex flex-col items-center justify-center text-center select-none',
      className
    )}>
    {#if code !== undefined}
      <p
        class="font-mono text-5xl font-extrabold tracking-widest sm:text-7xl md:text-8xl">
        <ShinyText
          text={String(code)}
          color="var(--color-copilot)"
          shineColor="var(--color-surface-card)"
          speed={1.5} />
      </p>
    {/if}
    <h1
      class="mt-4 text-2xl font-semibold tracking-tight text-balance text-text-primary sm:text-4xl">
      {title}
    </h1>
    {#if description}
      <p
        class="mt-6 text-lg font-medium text-pretty text-text-secondary sm:text-xl md:text-2xl">
        {description}
      </p>
    {/if}
    {#if actions}
      <div
        class="mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
        {@render actions()}
      </div>
    {:else if onRetry}
      <div class="mt-10">
        <Button
          variant="secondary"
          size="md"
          leadingIcon="bi-arrow-clockwise"
          onclick={onRetry}>
          {retryLabel}
        </Button>
      </div>
    {/if}
  </div>
{:else}
  <div
    role="alert"
    aria-live="assertive"
    class={cn(
      'flex flex-col items-center justify-center rounded-sm border border-danger/30 bg-danger-subtle/10 p-8 text-center select-none',
      className
    )}>
    <div
      class="mb-3 flex h-12 w-12 items-center justify-center rounded-sm bg-danger-subtle/30 text-danger">
      <i
        class="bi {icon} text-2xl"
        aria-hidden="true"></i>
    </div>
    <h3 class="text-sm font-bold text-text-primary">{title}</h3>
    {#if description}
      <p class="mt-1 max-w-xs text-xs text-text-secondary">{description}</p>
    {/if}

    {#if onRetry}
      <div class="mt-4">
        <Button
          variant="secondary"
          size="sm"
          leadingIcon="bi-arrow-clockwise"
          onclick={onRetry}>
          {retryLabel}
        </Button>
      </div>
    {/if}
  </div>
{/if}
