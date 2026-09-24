<script lang="ts">
  import {Calendar, Chart, Rect, Layer, Tooltip} from 'layerchart';
  import {scaleThreshold} from 'd3-scale';
  import {ChevronLeft, ChevronRight} from '@lucide/svelte';
  import type {WorkspaceCalendar} from '$lib/adminWorkspace';
  import {formatCount} from '$lib/adminWorkspace';
  import {formatAdminDate} from '$lib/adminDateFormat';
  import {adminDisplayStore} from '$lib/stores/adminDisplayStore.svelte';
  import {pluralize} from '$lib/utils/pluralize';
  import IconButton from '../IconButton.svelte';
  let {
    data,
    onPrevYear,
    onNextYear,
    canGoNext = true
  }: {
    data: WorkspaceCalendar;
    onPrevYear?: () => void;
    onNextYear?: () => void;
    canGoNext?: boolean;
  } = $props();
  const start = $derived(new Date(data.year, 0, 1));
  const end = $derived(new Date(data.year + 1, 0, 1));
  const days = $derived(
    data.days.map(row => {
      const [year, month, day] = row.date.split('-').map(Number);
      return {
        ...row,
        label: formatAdminDate(
          new Date(Date.UTC(year, month - 1, day)),
          'UTC',
          adminDisplayStore.current.dateFormat
        ),
        date: new Date(year, month - 1, day)
      };
    })
  );
  const maximum = $derived(Math.max(1, ...data.days.map(row => row.views)));
  const thresholds = $derived([
    1,
    Math.ceil(maximum / 4) + 1,
    Math.ceil(maximum / 2) + 1,
    Math.ceil((maximum * 3) / 4) + 1
  ]);
  const colors = [
    'var(--color-calendar-0)',
    'var(--color-calendar-1)',
    'var(--color-calendar-2)',
    'var(--color-calendar-3)',
    'var(--color-calendar-4)'
  ];
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
</script>

<div class="flex min-w-0 flex-col gap-3">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex flex-col gap-0.5">
      <h3 class="text-xs font-bold text-text-secondary">Article views</h3>
      <p class="text-2xs text-text-muted">
        Cumulative visits across all pages over the past year.
      </p>
    </div>
    <div class="flex items-center gap-3">
      <div
        class="flex items-center gap-1 text-2xs text-text-muted"
        aria-label="Color intensity increases with daily views">
        <span class="mr-1">Less</span>
        {#each colors as color (color)}<span
            class="size-3 rounded-sm"
            style:background={color}
            aria-hidden="true"></span
          >{/each}
        <span class="ml-1">More</span>
      </div>
      <div class="flex items-center gap-1">
        <IconButton
          ariaLabel={`Show ${data.year - 1}`}
          size="xs"
          onclick={onPrevYear}><ChevronLeft class="size-3.5" /></IconButton>
        <IconButton
          ariaLabel={`Show ${data.year + 1}`}
          size="xs"
          disabled={!canGoNext}
          onclick={onNextYear}><ChevronRight class="size-3.5" /></IconButton>
      </div>
    </div>
  </div>
  <div
    class="views-calendar-chart"
    role="img"
    aria-label={`Daily article views for ${data.year}. Hover a day for its exact value.`}>
    <Chart
      data={days}
      x="date"
      c="views"
      cScale={scaleThreshold<number, string>().unknown(
        'var(--color-calendar-0)'
      )}
      cDomain={thresholds}
      cRange={colors}
      padding={{top: 20, left: 48}}
      height={160}>
      {#snippet children({context})}
        <Layer>
          <Calendar
            {start}
            {end}
            tooltip
            monthLabel={{fill: 'var(--color-text-muted)', fontSize: 12}}>
            {#snippet children({cells, cellSize})}
              {#each dayLabels as label, i (label)}
                <text
                  x={-20}
                  y={i * cellSize[1] + cellSize[1] / 2}
                  fill="var(--color-text-muted)"
                  font-size="12"
                  text-anchor="end"
                  dominant-baseline="middle">{label}</text>
              {/each}
              {#each cells as cell (cell)}
                {@const padding = 2}
                <Rect
                  x={cell.x + padding}
                  y={cell.y + padding}
                  width={cellSize[0] - padding * 2}
                  height={cellSize[1] - padding * 2}
                  rx={4}
                  fill={cell.color ?? 'rgb(0 0 0 / 5%)'}
                  onpointermove={e => context.tooltip?.show(e, cell.data)}
                  onpointerleave={e => context.tooltip?.hide()} />
              {/each}
            {/snippet}
          </Calendar>
        </Layer>
        <Tooltip.Root variant="none">
          {#snippet children({data: day})}
            {#if day?.views != null}
              <div
                class="rounded-md border border-border-subtle bg-surface-elevated px-3 py-2 text-xs shadow-md">
                <p class="text-text-secondary">{day.label}</p>
                <p class="font-semibold text-accent">
                  {pluralize(day.views, 'view', undefined, formatCount)}
                </p>
              </div>
            {/if}
          {/snippet}
        </Tooltip.Root>
      {/snippet}
    </Chart>
  </div>
</div>
