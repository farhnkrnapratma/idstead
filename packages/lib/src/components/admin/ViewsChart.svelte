<script lang="ts">
    import { Chart, Svg, Axis, Spline, Bars, Tooltip, Highlight } from 'layerchart';
    import { ChartColumnBig, ChartSpline } from '@lucide/svelte';
    import { onMount } from 'svelte';

    import { scaleBand, scaleLinear } from 'd3-scale';
    import { curveMonotoneX } from 'd3-shape';

    import Chip from '../Chip.svelte';
    import LoadingState from '../LoadingState.svelte';
    import ErrorState from '../ErrorState.svelte';
    import EmptyState from '../EmptyState.svelte';
    import { cn } from '#lib/utils/cn.ts';
    import { hasChartActivity } from '#lib/adminWorkspace.ts';
    import { activityDate, activityTimestamp } from '#lib/adminActivity.ts';
    import { adminDisplayStore } from '#lib/stores/adminDisplayStore.svelte.ts';
    import { VIEWS_RANGES, type ViewsRange, type ViewsBucketRow } from './viewsRange';
    import {
        ADMIN_CHART_AXIS_CLASSES,
        ADMIN_CHART_PADDING,
        ADMIN_CHART_X_TICK_LABEL_PROPS,
        ADMIN_CHART_Y_TICK_LABEL_PROPS,
        ADMIN_CHART_TICK_LENGTH
    } from '#lib/utils/chartAxisStyles.ts';

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
        description = 'Cumulative visits across all pages.',
        data = [],
        isLoading = false,
        error = '',
        onRangeChange,
        onRetry,
        class: className = ''
    }: Props = $props();

    const series = $derived(
        data.map(row => ({
            label: activityTimestamp(row.bucket, timeZone, adminDisplayStore.current),
            axisLabel: activityDate(row.bucket, timeZone, adminDisplayStore.current),
            views: Number(row.views),
            partial: 'partial' in row && row.partial ? 'Partial interval' : ''
        }))
    );
    const axisLabels = $derived(new Map(series.map(row => [row.label, row.axisLabel])));
    const hasActivity = $derived(hasChartActivity(series.map(row => row.views)));
    const maxViews = $derived(Math.max(ceiling, ...series.map(d => d.views)));
    const tickCount = $derived(Math.min(6, series.length));
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
            <h2 class="type-card-title">{title}</h2>
            <p class="text-xs text-text-muted">
                {description}
            </p>
        </div>
        <div class="flex items-center gap-2">
            {#if hasActivity || isLoading || error}
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
            {/if}

            {#if hasActivity}
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
            {/if}
        </div>
    </div>

    {#if isLoading}
        <LoadingState
            variant="spinner"
            class="h-65" />
    {:else if error}
        <ErrorState
            title="Unable to load views"
            description={error}
            size="inline"
            {onRetry} />
    {:else if !hasActivity}
        <EmptyState
            title="No views in this period"
            description="There are no article views to display for the selected range." />
    {:else}
        <div
            class="h-65 w-full"
            role="img"
            aria-label={`${title} over time. Hover a point for its exact value.`}>
            <Chart
                data={series}
                x="label"
                xScale={scaleBand().padding(chartType === 'bar' ? 0.25 : 0.05)}
                y="views"
                yScale={scaleLinear()}
                yDomain={[0, maxViews]}
                padding={ADMIN_CHART_PADDING}>
                <Svg clip>
                    <Axis
                        placement="bottom"
                        grid={false}
                        ticks={tickCount}
                        tickOcclusion
                        format={value => axisLabels.get(value) ?? value}
                        tickLabelProps={ADMIN_CHART_X_TICK_LABEL_PROPS}
                        tickLength={ADMIN_CHART_TICK_LENGTH}
                        classes={ADMIN_CHART_AXIS_CLASSES} />
                    <Axis
                        placement="left"
                        grid={{
                            stroke: 'var(--color-border-subtle)',
                            dashArray: '3 3',
                            opacity: 0.4
                        }}
                        tickLabelProps={ADMIN_CHART_Y_TICK_LABEL_PROPS}
                        tickLength={ADMIN_CHART_TICK_LENGTH}
                        classes={ADMIN_CHART_AXIS_CLASSES} />
                    {#if chartType === 'bar'}
                        <Bars
                            radius={3}
                            fill="var(--color-accent)"
                            class="transition-opacity duration-200 hover:opacity-85" />
                        <Highlight area={{ class: 'fill-surface-hover/30' }} />
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
                            lines={{ class: 'stroke-border-subtle' }} />
                    {/if}
                </Svg>
                <Tooltip.Root variant="none">
                    {#snippet children({
                        data
                    }: {
                        data: { label: string; views: number; partial: string };
                    })}
                        {#if data}
                            <div
                                class="rounded-md border border-border-subtle bg-surface-elevated px-2.5 py-1.5 text-xs shadow-md">
                                <div class="font-medium text-text-primary">{data.label}</div>
                                <div class="font-mono font-semibold text-accent-text">
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
    {/if}
</div>
