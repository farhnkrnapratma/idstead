<script lang="ts">
  import {OctagonAlert} from '@lucide/svelte';
  import {cn} from '../utils/cn';

  interface Props {
    title?: string;
    errors: string[];
    class?: string;
  }

  let {
    title = 'Please fix the following errors:',
    errors = [],
    class: className = ''
  }: Props = $props();
</script>

{#if errors.length > 0}
  <div
    role="alert"
    aria-live="assertive"
    class={cn(
      'mb-4 rounded-sm border border-danger/30 bg-danger-subtle/20 p-4 text-xs select-none',
      className
    )}>
    <div class="flex items-center gap-2 font-bold text-danger">
      <OctagonAlert class="size-4 shrink-0" />
      <span>{title}</span>
    </div>
    <ul class="mt-2 flex list-disc flex-col gap-1 pl-5 font-medium text-danger">
      {#each errors as error (error)}
        <li>{error}</li>
      {/each}
    </ul>
  </div>
{/if}
