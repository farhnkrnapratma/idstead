<script lang="ts">
  import {Calendar, Chart, Rect, Layer, Tooltip} from 'layerchart';
  import {scaleThreshold} from 'd3-scale';
  import type {WorkspaceCalendar} from '$lib/adminWorkspace';
  import {formatCount} from '$lib/adminWorkspace';
  import Button from '../Button.svelte';
  import DataTable from '../DataTable.svelte';
  let {data}: {data: WorkspaceCalendar} = $props();
  let showTable = $state(false);
  const start = $derived(new Date(data.year, 0, 1));
  const end = $derived(new Date(data.year + 1, 0, 1));
  const days = $derived(
    data.days.map(row => {
      const [year, month, day] = row.date.split('-').map(Number);
      return {...row, label: row.date, date: new Date(year, month - 1, day)};
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
</script>

<div class="flex min-w-0 flex-col gap-3">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div>
      <h3 class="text-xs font-bold text-text-secondary">
        Article views · {data.year}
      </h3>
      <p class="text-2xs text-text-muted">Daily views · {data.timeZone}</p>
    </div>
    <Button
      type="ghost"
      size="sm"
      aria-expanded={showTable}
      onclick={() => (showTable = !showTable)}
      >{showTable ? 'Hide data table' : 'View data table'}</Button>
  </div>
  <div
    class="views-calendar-chart"
    role="img"
    aria-label={`Daily article views for ${data.year}. Exact values are available in the data table.`}>
    <Chart
      data={days}
      x="date"
      c="views"
      cScale={scaleThreshold<number, string>().unknown(
        'var(--color-calendar-0)'
      )}
      cDomain={thresholds}
      cRange={colors}
      padding={{top: 20}}
      height={160}>
      {#snippet children({context})}
        <Layer>
          <Calendar
            {start}
            {end}
            tooltip
            monthLabel={{fill: 'var(--color-text-muted)', fontSize: 12}}>
            {#snippet children({cells, cellSize})}
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
                <p class="text-text-secondary">{day.label} · {data.timeZone}</p>
                <p class="font-semibold text-accent">
                  {formatCount(day.views)} views
                </p>
              </div>
            {/if}
          {/snippet}
        </Tooltip.Root>
      {/snippet}
    </Chart>
  </div>
  <div
    class="flex items-center justify-end gap-1 text-2xs text-text-muted"
    aria-label="Color intensity increases with daily views">
    <span class="mr-1">Less</span>
    {#each colors as color (color)}<span
        class="size-3 rounded-sm"
        style:background={color}
        aria-hidden="true"></span
      >{/each}
    <span class="ml-1">More</span>
  </div>
  {#if showTable}
    <div class="max-h-80 overflow-auto">
      <DataTable
        caption={`Daily article views, ${data.timeZone}`}
        columns={[
          {key: 'date', header: 'Date'},
          {key: 'views', header: 'Views', align: 'right'}
        ]}
        data={data.days} />
    </div>
  {/if}
</div>
