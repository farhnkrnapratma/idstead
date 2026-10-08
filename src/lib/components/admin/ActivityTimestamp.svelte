<script lang="ts">
  import {activityTimestamp, activityTimeZone} from '#lib/adminActivity.ts';
  import {isRelativeTimestamp} from '#lib/adminDateFormat.ts';
  import {adminDisplayStore} from '#lib/stores/adminDisplayStore.svelte.ts';
  import {formatRelativeTime} from '#lib/utils/formatters.ts';
  import RelativeTime from '../RelativeTime.svelte';
  import {cn} from '#lib/utils/cn.ts';
  let {
    date,
    timeZone,
    prefix = '',
    compact = false,
    class: className = ''
  }: {
    date: string;
    timeZone?: string;
    prefix?: string;
    compact?: boolean;
    class?: string;
  } = $props();
  const prefs = $derived(adminDisplayStore.current);
  const formatted = $derived(activityTimestamp(date, timeZone, prefs));
  const zone = $derived(activityTimeZone(date, timeZone));
  const relative = $derived(isRelativeTimestamp(date, prefs.mode));
</script>

{#if relative}
  <RelativeTime
    {date}
    tag="time"
    prefix={prefix ? `${prefix}:` : ''}
    title={`${formatted} · ${zone}`}
    class={cn(
      'shrink-0 text-2xs whitespace-nowrap text-text-muted',
      className
    )} />
{:else}
  <time
    datetime={date}
    title={`${formatRelativeTime(date)} · ${zone}`}
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
