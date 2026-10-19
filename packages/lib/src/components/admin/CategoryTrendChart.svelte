<script lang="ts">
    import { Chart, Svg, Axis, Spline, Bars, Highlight, Tooltip } from 'layerchart';
    import { curveMonotoneX } from 'd3-shape';
    import { scaleBand, scaleLinear } from 'd3-scale';
    import { ChartColumnBig, ChartSpline, ChartPie } from '@lucide/svelte';
    import { onMount } from 'svelte';
    import Chip from '@fkp/ui/components/Chip.svelte';
    import LoadingState from '@fkp/ui/components/LoadingState.svelte';
    import ErrorState from '@fkp/ui/components/ErrorState.svelte';
    import EmptyState from '@fkp/ui/components/EmptyState.svelte';
    import { cn } from '@fkp/ui/utils/cn.ts';
    import { activityDate } from '#lib/adminActivity.ts';
    import { formatCount, hasChartActivity } from '#lib/adminWorkspace.ts';
    import { adminDisplayStore } from '#lib/stores/adminDisplayStore.svelte.ts';
    import { VIEWS_RANGES, type ViewsRange } from './viewsRange';
    import {
        ADMIN_CHART_AXIS_CLASSES,
        ADMIN_CHART_PADDING,
        ADMIN_CHART_X_TICK_LABEL_PROPS,
        ADMIN_CHART_Y_TICK_LABEL_PROPS,
        ADMIN_CHART_TICK_LENGTH
    } from '#lib/utils/chartAxisStyles.ts';
    import CategoryDonut from './CategoryDonut.svelte';
    import { segmentRounding } from '#lib/chartRounding.ts';

    interface SeriesConfig {
        key: string;
        label: string;
        color: string;
    }

    type TrendRow = { bucket: string; [key: string]: string | number };

    interface Props {
        title?: string;
        description?: string;
        data: TrendRow[];
        series: SeriesConfig[];
        timeZone?: string;
        isLoading?: boolean;
        error?: string;
        range?: ViewsRange;
        onRangeChange?: (range: ViewsRange) => void;
        onRetry?: () => void;
        class?: string;
        storageKey?: string;
        allowDonut?: boolean;
        donutUnit?: string;
    }

    let {
        title = 'Trend',
        description = '',
        data = [],
        series,
        timeZone = 'UTC',
        isLoading = false,
        error = '',
        range,
        onRangeChange,
        onRetry,
        class: className = '',
        storageKey = 'admin-trend-chart-type',
        allowDonut = false,
        donutUnit = 'responses'
    }: Props = $props();

    const donutSegments = $derived(
        series.map(s => ({
            label: s.label,
            color: s.color,
            value: data.reduce((sum, row) => sum + Number(row[s.key] ?? 0), 0)
        }))
    );

    const hasActivity = $derived(hasChartActivity(donutSegments.map(segment => segment.value)));
    const rows = $derived(
        data.map(row => ({
            ...row,
            label: activityDate(row.bucket, timeZone, adminDisplayStore.current)
        }))
    );
    const maxValue = $derived(
        Math.max(
            1,
            ...data.map(row => {
                const values = series.map(s => Number(row[s.key] ?? 0));
                return chartType === 'bar' ?
                        values.reduce((sum, value) => sum + value, 0)
                    :   Math.max(0, ...values);
            })
        )
    );
    const tickCount = $derived(Math.min(6, rows.length));

    let chartType = $state<'spline' | 'bar' | 'donut'>('spline');

    onMount(() => {
        let saved: string | null = null;
        try {
            saved = localStorage.getItem(storageKey);
        } catch {}
        if (saved === 'bar' || saved === 'spline' || (allowDonut && saved === 'donut'))
            chartType = saved;
    });

    function setChartType(type: 'spline' | 'bar' | 'donut') {
        chartType = type;
        try {
            localStorage.setItem(storageKey, type);
        } catch {}
    }
</script>

<div class={cn('flex flex-col gap-3', className)}>
    <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-col gap-0.5">
            <h2 class="type-card-title">{title}</h2>
            {#if description}
                <p class="text-xs text-text-muted">{description}</p>
            {/if}
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
                    {#if allowDonut}
                        <Chip
                            size="sm"
                            active={chartType === 'donut'}
                            onclick={() => setChartType('donut')}
                            ariaLabel="Donut chart"
                            title="Donut chart">
                            <ChartPie class="size-3.5" />
                        </Chip>
                    {/if}
                </div>
            {/if}
            {#if hasActivity}
                {#if range && onRangeChange}
                    <div
                        class="flex items-center gap-1.5"
                        role="group"
                        aria-label="Trend range">
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
            class="h-56" />
    {:else if error}
        <ErrorState
            description={error}
            size="inline"
            {onRetry} />
    {:else if !hasActivity}
        <EmptyState
            icon={chartType === 'bar' ? ChartColumnBig
            : chartType === 'donut' ? ChartPie
            : ChartSpline}
            title={`No ${donutUnit} in this period`}
            description="Nothing to show for the selected range." />
    {:else if chartType === 'donut'}
        <CategoryDonut
            segments={donutSegments}
            unit={donutUnit} />
    {:else}
        <div
            class="h-56 w-full"
            role="img"
            aria-label={`${title} over time, by category. Hover a point for exact values.`}>
            <Chart
                data={rows}
                x="label"
                xScale={scaleBand().padding(chartType === 'bar' ? 0.25 : 0.05)}
                y={series[0]?.key}
                yScale={scaleLinear()}
                yDomain={[0, maxValue]}
                series={series.map(s => ({ key: s.key, color: s.color, value: s.key }))}
                seriesLayout={chartType === 'bar' ? 'stack' : undefined}
                padding={ADMIN_CHART_PADDING}>
                <Svg clip>
                    <Axis
                        placement="bottom"
                        grid={false}
                        ticks={tickCount}
                        tickOcclusion
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
                        {#each series as s, index (s.key)}
                            <Bars
                                seriesKey={s.key}
                                fill={s.color}
                                radius={3}
                                rounded={(datum: Record<string, unknown>) =>
                                    segmentRounding(
                                        datum,
                                        series.map(s => s.key),
                                        index
                                    )}
                                class="transition-opacity duration-200 hover:opacity-85" />
                        {/each}
                        <Highlight area={{ class: 'fill-surface-hover/30' }} />
                    {:else}
                        {#each series as s (s.key)}
                            <Spline
                                y={s.key}
                                class="stroke-2"
                                curve={curveMonotoneX}
                                stroke={s.color} />
                        {/each}
                    {/if}
                </Svg>
                <Tooltip.Root variant="none">
                    {#snippet children({ data: point })}
                        {#if point}
                            <div
                                class="flex flex-col gap-1 rounded-md border border-border-subtle bg-surface-elevated px-2.5 py-1.5 text-xs shadow-md">
                                <div class="font-medium text-text-primary">{point.label}</div>
                                {#each series as s (s.key)}
                                    {@const value = Number(point[s.key] ?? 0)}
                                    {#if value > 0}
                                        <div class="flex items-center gap-1.5">
                                            <span
                                                class="size-2 shrink-0 rounded-full"
                                                style:background={s.color}
                                                aria-hidden="true"></span>
                                            <span>{s.label}: {formatCount(value)}</span>
                                        </div>
                                    {/if}
                                {/each}
                            </div>
                        {/if}
                    {/snippet}
                </Tooltip.Root>
            </Chart>
        </div>
        <div
            class="flex flex-wrap items-center gap-x-3 gap-y-1.5"
            role="group"
            aria-label="Legend">
            {#each series as s (s.key)}
                <span class="flex items-center gap-1.5 text-xs text-text-secondary">
                    <span
                        class="size-2.5 shrink-0 rounded-full"
                        style:background={s.color}
                        aria-hidden="true"></span>
                    {s.label}
                </span>
            {/each}
        </div>
    {/if}
</div>
