<script lang="ts">
  import {Chart, Svg, Axis, Spline, Bars, Tooltip, Highlight} from 'layerchart';
  import {ChartColumnBig, ChartSpline} from '@lucide/svelte';
  import {onMount} from 'svelte';

  import {scaleBand, scaleLinear} from 'd3-scale';
  import {curveMonotoneX} from 'd3-shape';

  import Chip from '../Chip.svelte';
  import DataTable from '../DataTable.svelte';
  import Button from '../Button.svelte';
  import LoadingState from '../LoadingState.svelte';
  import ErrorState from '../ErrorState.svelte';
  import {cn} from '$lib/utils/cn';
  import {activityTimestamp} from '$lib/adminActivity';
  import {
    VIEWS_RANGES,
    type ViewsRange,
    type ViewsBucketRow
  } from './viewsRange';

  interface Props {
    ceiling?: number;
    range?: ViewsRange;
    timeZone?: string;
    title?: string;
    description?: string;
    data: ViewsBucketRow[];
    isLoading?: boolean;
    error?: string;
    onRangeChange?: (range: ViewsRange) => void;
    onRetry?: () => void;
    class?: string;
  }

  let {
    ceiling = 4,
    range,
    timeZone = 'UTC',
    title = 'Article views',
    description = 'Each visitor is counted once per article.',
    data = [],
    isLoading = false,
    error = '',
    onRangeChange,
    onRetry,
    class: className = ''
  }: Props = $props();

  const series = $derived(
    data.map(row => ({
      label: activityTimestamp(row.bucket, timeZone),
      views: Number(row.views),
      partial: 'partial' in row && row.partial ? 'Partial interval' : ''
    }))
  );
  const maxViews = $derived(Math.max(ceiling, ...series.map(d => d.views)));
  const tickCount = $derived(Math.min(6, series.length));
  let showTable = $state(false);
  let chartType = $state<'spline' | 'bar'>('spline');

  onMount(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('admin-views-chart-type');
    } catch {}
    if (saved === 'bar' || saved === 'spline') {
      chartType = saved;
    }
  });

  function setChartType(type: 'spline' | 'bar') {
    chartType = type;
    try {
      localStorage.setItem('admin-views-chart-type', type);
    } catch {}
  }
</script>

<div class={cn('flex flex-col gap-3', className)}>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex flex-col gap-0.5">
      <h3 class="text-xs font-bold text-text-secondary">{title}</h3>
      <p class="text-2xs text-text-muted">
        {description}
      </p>
    </div>
    <div class="flex items-center gap-2">
      <div
        class="flex items-center gap-1"
        role="group"
        aria-label="Chart type">
        <Chip
          size="sm"
          active={chartType === 'spline'}
          onclick={() => setChartType('spline')}
          ariaLabel="Spline chart"
          title="Spline chart">
          <ChartSpline class="size-3.5" />
        </Chip>
        <Chip
          size="sm"
          active={chartType === 'bar'}
          onclick={() => setChartType('bar')}
          ariaLabel="Bar chart"
          title="Bar chart">
          <ChartColumnBig class="size-3.5" />
        </Chip>
      </div>

      {#if range && onRangeChange}
        <div
          class="flex items-center gap-1.5"
          role="group"
          aria-label="Views range">
          {#each Object.entries(VIEWS_RANGES) as [id, config] (id)}
            <Chip
              size="sm"
              active={range === id}
              onclick={() => onRangeChange?.(id as ViewsRange)}
              >{config.label}</Chip>
          {/each}
        </div>
      {/if}
      <Button
        type="ghost"
        size="sm"
        onclick={() => (showTable = !showTable)}
        aria-expanded={showTable}
        >{showTable ? 'Hide data table' : 'View data table'}</Button>
    </div>
  </div>

  {#if isLoading}
    <LoadingState
      variant="spinner"
      class="h-65" />
  {:else if error}
    <ErrorState
      code={error}
      size="inline"
      {onRetry} />
  {:else}
    <div
      class="h-65 w-full"
      role="img"
      aria-label={`${title} over time. Exact values are available in the data table.`}>
      <Chart
        data={series}
        x="label"
        xScale={scaleBand().padding(chartType === 'bar' ? 0.25 : 0.05)}
        y="views"
        yScale={scaleLinear()}
        yDomain={[0, maxViews]}
        padding={{top: 16, right: 12, bottom: 34, left: 44}}>
        <Svg clip>
          <Axis
            placement="bottom"
            grid={false}
            ticks={tickCount}
            tickOcclusion
            tickLabelProps={{stroke: 'none', strokeWidth: 0}}
            classes={{
              tick: 'text-xs sm:text-sm fill-text-muted font-mono',
              rule: 'stroke-border-subtle'
            }} />
          <Axis
            placement="left"
            grid={{
              stroke: 'var(--color-border-subtle)',
              dashArray: '3 3',
              opacity: 0.4
            }}
            tickLabelProps={{stroke: 'none', strokeWidth: 0}}
            classes={{
              tick: 'text-xs sm:text-sm fill-text-muted font-mono',
              rule: 'stroke-border-subtle'
            }} />
          {#if chartType === 'bar'}
            <Bars
              radius={3}
              fill="var(--color-accent)"
              class="transition-opacity duration-200 hover:opacity-85" />
            <Highlight area={{class: 'fill-surface-hover/30'}} />
          {:else}
            <Spline
              class="stroke-2"
              curve={curveMonotoneX}
              stroke="var(--color-accent)" />
            <Highlight
              points={{
                class: 'fill-surface-card stroke-2',
                stroke: 'var(--color-accent)',
                r: 4
              }}
              lines={{class: 'stroke-border-subtle'}} />
          {/if}
        </Svg>
        <Tooltip.Root variant="none">
          {#snippet children({
            data
          }: {
            data: {label: string; views: number; partial: string};
          })}
            {#if data}
              <div
                class="rounded-md border border-border-subtle bg-surface-elevated px-2.5 py-1.5 text-xs shadow-md">
                <div class="font-medium text-text-primary">{data.label}</div>
                <div class="font-mono font-semibold text-accent">
                  {data.views}
                  {title.toLowerCase()}
                  {data.partial}
                </div>
              </div>
            {/if}
          {/snippet}
        </Tooltip.Root>
      </Chart>
    </div>
    {#if showTable}
      <DataTable
        caption={`${title} by interval, ${timeZone}`}
        columns={[
          {key: 'label', header: 'Interval'},
          {key: 'views', header: title, align: 'right'},
          {key: 'partial', header: 'Status'}
        ]}
        data={series} />
    {/if}
  {/if}
</div>
