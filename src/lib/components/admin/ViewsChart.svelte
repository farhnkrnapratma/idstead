<script lang="ts">
  import {Chart, Svg, Axis, Spline, Tooltip, Highlight} from 'layerchart';
  import {SvelteMap} from 'svelte/reactivity';
  import {scaleBand, scaleLinear} from 'd3-scale';
  import {curveMonotoneX} from 'd3-shape';
  import {timeDay, timeHour} from 'd3-time';
  import {timeFormat} from 'd3-time-format';
  import Chip from '../Chip.svelte';
  import LoadingState from '../LoadingState.svelte';
  import ErrorState from '../ErrorState.svelte';
  import {cn} from '$lib/utils/cn';
  import {
    VIEWS_RANGES,
    type ViewsRange,
    type ViewsBucketRow
  } from './viewsRange';

  interface Props {
    range: ViewsRange;
    data: ViewsBucketRow[];
    isLoading?: boolean;
    error?: string;
    onRangeChange: (range: ViewsRange) => void;
    onRetry?: () => void;
    class?: string;
  }

  let {
    range,
    data = [],
    isLoading = false,
    error = '',
    onRangeChange,
    onRetry,
    class: className = ''
  }: Props = $props();

  const formatHour = timeFormat('%H:00');
  const formatDay = timeFormat('%b %d');

  const series = $derived.by(() => {
    const config = VIEWS_RANGES[range];
    const counts = new SvelteMap<number, number>();
    for (const row of data) {
      counts.set(new Date(row.bucket).getTime(), Number(row.views) || 0);
    }

    const now = new Date();
    const interval = config.bucket === 'hour' ? timeHour : timeDay;
    const start = interval.offset(interval.floor(now), -(config.buckets - 1));
    const format = config.bucket === 'hour' ? formatHour : formatDay;

    return interval
      .range(start, interval.offset(now, 1))
      .map(date => ({
        label: format(date),
        views: counts.get(date.getTime()) ?? 0
      }));
  });

  const maxViews = $derived(Math.max(4, ...series.map(d => d.views)));
  const tickCount = $derived(range === '30d' ? 8 : 6);
</script>

<div class={cn('flex flex-col gap-3', className)}>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex flex-col gap-0.5">
      <h3 class="text-xs font-bold text-text-secondary">Blog readers</h3>
      <p class="text-2xs text-text-muted">
        Counted once per reader, per post, per day
      </p>
    </div>
    <div
      class="flex items-center gap-1.5"
      role="group"
      aria-label="Views range">
      {#each Object.entries(VIEWS_RANGES) as [id, config] (id)}
        <Chip
          size="sm"
          active={range === id}
          onclick={() => onRangeChange(id as ViewsRange)}>
          {config.label}
        </Chip>
      {/each}
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
    <div class="h-65 w-full">
      <Chart
        data={series}
        x="label"
        xScale={scaleBand().padding(0.05)}
        y="views"
        yScale={scaleLinear()}
        yDomain={[0, maxViews]}
        padding={{top: 16, right: 12, bottom: 34, left: 44}}>
        <Svg clip>
          <Axis
            placement="bottom"
            grid={false}
            ticks={tickCount}
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
        </Svg>
        <Tooltip.Root>
          {#snippet children({data}: {data: {label: string; views: number}})}
            {#if data}
              <div
                class="rounded-md border border-border-subtle bg-surface-elevated px-2.5 py-1.5 text-xs shadow-md">
                <div class="font-medium text-text-primary">{data.label}</div>
                <div class="font-mono font-semibold text-accent">
                  {data.views}
                  {data.views === 1 ? 'reader' : 'readers'}
                </div>
              </div>
            {/if}
          {/snippet}
        </Tooltip.Root>
      </Chart>
    </div>
  {/if}
</div>
