<script lang="ts">
  import {activityTimestamp, activityTimeZone} from '$lib/adminActivity';
  import RelativeTime from '../RelativeTime.svelte';
  import {cn} from '$lib/utils/cn';
  let {
    date,
    timeZone,
    prefix = '',
    compact = false,
    relative = false,
    class: className = ''
  }: {
    date: string;
    timeZone?: string;
    prefix?: string;
    compact?: boolean;
    relative?: boolean;
    class?: string;
  } = $props();
  const formatted = $derived(activityTimestamp(date, timeZone));
  const zone = $derived(activityTimeZone(date, timeZone));
</script>

{#if relative}
  <RelativeTime
    {date}
    tag="time"
    title={`${formatted} · ${zone}`}
    class={cn(
      'shrink-0 text-2xs whitespace-nowrap text-text-muted',
      className
    )} />
{:else}
  <time
    datetime={date}
    title={`${formatted} · ${zone}`}
    aria-label={`${prefix ? prefix + ': ' : ''}${formatted} · ${zone}`}
    class={cn(
      'shrink-0 text-2xs whitespace-nowrap text-text-muted',
      className
    )}>
    {#if prefix}<span class={compact ? 'hidden sm:inline' : ''}
        >{prefix}:&nbsp;</span
      >{/if}{formatted}
  </time>
{/if}
