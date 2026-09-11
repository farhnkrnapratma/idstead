<script lang="ts">
  import Badge from '../Badge.svelte';
  import ActivityTimestamp from './ActivityTimestamp.svelte';
  import {reportReasonLabel, reportReasonColor} from '$lib/reportReasons';
  import {cn} from '$lib/utils/cn';
  let {
    reports = [],
    focusedId,
    class: className = ''
  }: {
    reports: {
      id: string;
      reason: string;
      details?: string | null;
      created_at: string;
    }[];
    focusedId?: string;
    class?: string;
  } = $props();
</script>

<ul
  class={cn(
    'flex flex-col gap-3 rounded-md border border-border-subtle p-2.5',
    className
  )}>
  {#each reports as report (report.id)}
    <li
      id={`report-event-${report.id}`}
      tabindex="-1"
      class={cn(
        'flex scroll-mt-20 flex-col gap-2 rounded-sm outline-none not-last:border-b not-last:border-border-subtle not-last:pb-3 focus-visible:ring-2 focus-visible:ring-focus-ring',
        focusedId === report.id ? 'bg-accent-subtle/40' : ''
      )}>
      <div class="flex flex-wrap items-center gap-1.5">
        <Badge
          variant="custom"
          color={reportReasonColor(report.reason)}
          class="py-0.5 text-2xs">{reportReasonLabel(report.reason)}</Badge>
        <ActivityTimestamp
          date={report.created_at}
          prefix="Reported at"
          class="ml-auto" />
      </div>
      <p
        class="font-sans text-xs leading-relaxed break-words whitespace-pre-wrap text-text-secondary">
        {report.details || 'No description provided.'}
      </p>
    </li>
  {/each}
</ul>
