<script lang="ts">
  import {activityTimestamp, activityTimeZone} from '$lib/adminActivity';
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
  const formatted = $derived(activityTimestamp(date, timeZone));
  const zone = $derived(activityTimeZone(date, timeZone));
</script>

<time
  datetime={date}
  title={`${formatted} · ${zone}`}
  aria-label={`${prefix ? prefix + ': ' : ''}${formatted} · ${zone}`}
  class={`shrink-0 text-2xs whitespace-nowrap text-text-muted ${className}`}>
  {#if prefix}<span class={compact ? 'hidden sm:inline' : ''}
      >{prefix}:&nbsp;</span
    >{/if}{formatted}
</time>
