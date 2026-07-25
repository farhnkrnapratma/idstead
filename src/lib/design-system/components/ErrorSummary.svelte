<!-- @format -->
<script lang="ts">
  import {cn} from '../utils/cn'

  interface Props {
    title?: string
    errors: string[]
    class?: string
  }

  let {
    title = 'Please fix the following errors:',
    errors = [],
    class: className = ''
  }: Props = $props()
</script>

{#if errors.length > 0}
  <div
    role="alert"
    aria-live="assertive"
    class={cn(
      'mb-4 rounded-xl border border-danger/30 bg-danger-subtle/20 p-4 text-xs select-none',
      className
    )}
  >
    <div class="flex items-center gap-2 font-bold text-danger">
      <i class="bi bi-exclamation-octagon-fill text-sm" aria-hidden="true"></i>
      <span>{title}</span>
    </div>
    <ul class="mt-2 flex list-disc flex-col gap-1 pl-5 font-medium text-danger">
      {#each errors as error (error)}
        <li>{error}</li>
      {/each}
    </ul>
  </div>
{/if}
