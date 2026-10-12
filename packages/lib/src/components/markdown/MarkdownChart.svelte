<script lang="ts">
    import {
        Chart,
        Svg,
        Axis,
        Spline,
        Area,
        Bars,
        Pie,
        Arc,
        Tooltip,
        Highlight,
        LinearGradient
    } from 'layerchart';
    import { scaleBand, scaleLinear, scaleOrdinal } from 'd3-scale';
    import { curveMonotoneX } from 'd3-shape';

    import { EllipsisVertical, Copy } from '@lucide/svelte';
    import Dropdown from '../Dropdown.svelte';
    import { toastStore } from '../../stores/toastStore.svelte';
    import {
        ADMIN_CHART_AXIS_CLASSES,
        ADMIN_CHART_PADDING,
        ADMIN_CHART_X_TICK_LABEL_PROPS,
        ADMIN_CHART_Y_TICK_LABEL_PROPS,
        ADMIN_CHART_TICK_LENGTH
    } from '#lib/utils/chartAxisStyles.ts';

    export interface ChartSpec {
        type?: 'line' | 'bar' | 'area' | 'donut' | 'pie';
        title?: string;
        subtitle?: string;
        x?: string;
        y?: string | string[];
        series?: Array<{ key: string; label?: string; color?: string }>;
        data?: Array<Record<string, any>>;
        height?: number;
    }

    interface Props {
        spec: ChartSpec;
        class?: string;
    }

    let { spec, class: className = '' }: Props = $props();

    async function copySpecJson() {
        try {
            await navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
            toastStore.success('Chart spec copied');
        } catch {
            toastStore.error('Failed to copy chart spec');
        }
    }

    const chartType = $derived(spec.type || 'line');
    const rawData = $derived(Array.isArray(spec.data) ? spec.data : []);
    const xKey = $derived(spec.x || Object.keys(rawData[0] || {})[0] || 'x');
    const yKey = $derived(
        typeof spec.y === 'string' ? spec.y : Object.keys(rawData[0] || {})[1] || 'y'
    );
    const chartHeight = $derived(spec.height || 300);

    const defaultColors = [
        'var(--color-accent)',
        'var(--color-activity-helpful)',
        'var(--color-activity-report)',
        'var(--color-activity-unhelpful)',
        'var(--color-copilot-purple)',
        'var(--color-report-sexual)'
    ];

    const seriesList = $derived.by(() => {
        if (spec.series && spec.series.length > 0) {
            return spec.series.map((s, idx) => ({
                key: s.key,
                label: s.label || s.key,
                color: s.color || defaultColors[idx % defaultColors.length]
            }));
        }
        if (Array.isArray(spec.y)) {
            return spec.y.map((k, idx) => ({
                key: k,
                label: k,
                color: defaultColors[idx % defaultColors.length]
            }));
        }
        return [{ key: yKey, label: spec.title || yKey, color: defaultColors[0] }];
    });

    const pieData = $derived.by(() => {
        if (chartType !== 'pie' && chartType !== 'donut') return [];
        return rawData.map((d, idx) => ({
            label: String(d[xKey] ?? `Item ${idx + 1}`),
            value: Number(d[yKey] ?? 0),
            color: defaultColors[idx % defaultColors.length]
        }));
    });

    const computedYDomain = $derived.by(() => {
        const allValues = rawData
            .flatMap(d => seriesList.map(s => Number(d[s.key])))
            .filter(v => typeof v === 'number' && !isNaN(v));
        if (!allValues.length) return [0, 100];
        const minVal = Math.min(...allValues);
        const maxVal = Math.max(...allValues);
        const domainMin = minVal < 0 ? minVal * 1.1 : 0;
        const domainMax =
            maxVal === 0 ? 10
            : maxVal > 0 ? maxVal * 1.08
            : 0;
        return [domainMin, domainMax];
    });
</script>

<div
    class="relative my-6 flex flex-col gap-2 rounded-md glass-card border border-border-subtle/60 p-4 shadow-md backdrop-blur-md transition-colors {className}">
    <div class="flex items-start justify-between gap-2">
        {#if spec.title || spec.subtitle}
            <div class="flex min-w-0 flex-col gap-0.5">
                {#if spec.title}
                    <div class="text-sm leading-tight font-bold text-text-primary">
                        {spec.title}
                    </div>
                {/if}
                {#if spec.subtitle}
                    <div class="text-xs leading-tight text-text-muted">
                        {spec.subtitle}
                    </div>
                {/if}
            </div>
        {:else}
            <div></div>
        {/if}

        <Dropdown
            ariaLabel="Chart options"
            placement="bottom-end"
            actions={[{ label: 'Copy spec JSON', icon: Copy, onSelect: copySpecJson }]}>
            {#snippet trigger({ isOpen, toggle })}
                <button
                    type="button"
                    aria-label="Chart options"
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    class="flex size-7 cursor-pointer items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-focus-ring"
                    onclick={toggle}>
                    <EllipsisVertical class="size-4" />
                </button>
            {/snippet}
        </Dropdown>
    </div>

    {#if rawData.length === 0}
        <div
            class="flex h-40 items-center justify-center rounded-md border border-dashed border-border-subtle/50 text-xs text-text-muted">
            No chart data provided
        </div>
    {:else}
        <div
            class="relative w-full overflow-hidden"
            style="height: {chartHeight}px;">
            {#if chartType === 'bar'}
                <Chart
                    data={rawData}
                    x={xKey}
                    xScale={scaleBand().padding(0.3)}
                    y={yKey}
                    yScale={scaleLinear()}
                    yDomain={computedYDomain}
                    padding={ADMIN_CHART_PADDING}>
                    <Svg clip>
                        <Axis
                            placement="bottom"
                            grid={false}
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
                        <Bars
                            radius={3}
                            fill={seriesList[0]?.color || defaultColors[0]}
                            class="transition-opacity duration-200 hover:opacity-85" />
                        <Highlight area={{ class: 'fill-surface-hover/30' }} />
                    </Svg>
                    <Tooltip.Root variant="none">
                        {#snippet children({ data })}
                            {#if data}
                                <div
                                    class="rounded-md border border-border-subtle bg-surface-elevated px-2.5 py-1.5 text-xs shadow-md">
                                    <div class="font-medium text-text-primary">{data[xKey]}</div>
                                    <div class="font-mono font-semibold text-accent">
                                        {data[yKey]}
                                    </div>
                                </div>
                            {/if}
                        {/snippet}
                    </Tooltip.Root>
                </Chart>
            {:else if chartType === 'area'}
                <Chart
                    data={rawData}
                    x={xKey}
                    xScale={scaleBand().padding(0.05)}
                    y={yKey}
                    yScale={scaleLinear()}
                    yDomain={computedYDomain}
                    padding={ADMIN_CHART_PADDING}>
                    <Svg clip>
                        <LinearGradient
                            id="chartAreaGradient"
                            stops={[
                                ['0%', seriesList[0]?.color || defaultColors[0]],
                                ['100%', 'transparent']
                            ]}
                            vertical />
                        <Axis
                            placement="bottom"
                            grid={false}
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
                        <Area
                            curve={curveMonotoneX}
                            line={{
                                class: 'stroke-2',
                                stroke: seriesList[0]?.color || defaultColors[0]
                            }}
                            fill="url(#chartAreaGradient)" />
                        <Spline
                            curve={curveMonotoneX}
                            class="stroke-2"
                            stroke={seriesList[0]?.color || defaultColors[0]} />
                        <Highlight
                            points={{
                                class: 'fill-surface-card stroke-2',
                                stroke: seriesList[0]?.color || defaultColors[0],
                                r: 4
                            }}
                            lines={{ class: 'stroke-border-subtle stroke-dasharray-2' }} />
                    </Svg>
                    <Tooltip.Root variant="none">
                        {#snippet children({ data })}
                            {#if data}
                                <div
                                    class="rounded-md border border-border-subtle bg-surface-elevated px-2.5 py-1.5 text-xs shadow-md">
                                    <div class="font-medium text-text-primary">{data[xKey]}</div>
                                    <div class="font-mono font-semibold text-accent">
                                        {data[yKey]}
                                    </div>
                                </div>
                            {/if}
                        {/snippet}
                    </Tooltip.Root>
                </Chart>
            {:else if chartType === 'pie' || chartType === 'donut'}
                <div
                    class="flex h-full w-full flex-col items-center justify-center gap-4 py-2 sm:flex-row sm:gap-6 sm:py-0">
                    <div class="relative aspect-square size-44 shrink-0 sm:size-52">
                        <Chart
                            data={pieData}
                            x="value"
                            c="label"
                            cScale={scaleOrdinal()}
                            cRange={pieData.map(d => d.color)}>
                            <Svg center>
                                <Pie
                                    range={[0, 360]}
                                    innerRadius={chartType === 'donut' ? 0.6 : 0}
                                    padAngle={0}
                                    cornerRadius={3}>
                                    {#snippet children({ arcs })}
                                        {#each arcs as arc, i (arc.data?.label ?? i)}
                                            <Arc
                                                startAngle={arc.startAngle}
                                                endAngle={arc.endAngle}
                                                padAngle={arc.padAngle}
                                                innerRadius={chartType === 'donut' ? 0.6 : 0}
                                                cornerRadius={3}
                                                fill={arc.data.color}
                                                data={arc.data}
                                                tooltip />
                                        {/each}
                                    {/snippet}
                                </Pie>
                            </Svg>
                            <Tooltip.Root variant="none">
                                {#snippet children({ data })}
                                    {#if data}
                                        <div
                                            class="rounded-md border border-border-subtle bg-surface-elevated px-2.5 py-1.5 text-xs shadow-md">
                                            <div class="font-medium text-text-primary">
                                                {data.label}
                                            </div>
                                            <div class="font-mono font-semibold text-accent">
                                                {data.value}
                                            </div>
                                        </div>
                                    {/if}
                                {/snippet}
                            </Tooltip.Root>
                        </Chart>
                    </div>
                    <div
                        class="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:flex sm:w-auto sm:flex-col sm:gap-1.5">
                        {#each pieData as item (item.label)}
                            <div class="flex min-w-0 items-center gap-2">
                                <span
                                    class="size-2.5 shrink-0 rounded-full"
                                    style="background-color: {item.color};"></span>
                                <span class="truncate text-text-secondary">{item.label}:</span>
                                <span
                                    class="ml-auto font-mono font-medium text-text-primary sm:ml-0"
                                    >{item.value}</span>
                            </div>
                        {/each}
                    </div>
                </div>
            {:else}
                <Chart
                    data={rawData}
                    x={xKey}
                    xScale={scaleBand().padding(0.1)}
                    y={yKey}
                    yScale={scaleLinear()}
                    yDomain={computedYDomain}
                    padding={ADMIN_CHART_PADDING}>
                    <Svg clip>
                        <Axis
                            placement="bottom"
                            grid={false}
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
                        {#each seriesList as s (s.key)}
                            <Spline
                                y={s.key}
                                curve={curveMonotoneX}
                                class="stroke-2"
                                stroke={s.color} />
                        {/each}
                        <Highlight
                            points={{
                                class: 'fill-surface-card stroke-2',
                                stroke: seriesList[0]?.color || defaultColors[0],
                                r: 4
                            }}
                            lines={{ class: 'stroke-border-subtle stroke-dasharray-2' }} />
                    </Svg>
                    <Tooltip.Root variant="none">
                        {#snippet children({ data })}
                            {#if data}
                                <div
                                    class="rounded-md border border-border-subtle bg-surface-elevated px-2.5 py-1.5 text-xs shadow-md">
                                    <div class="font-medium text-text-primary">{data[xKey]}</div>
                                    {#each seriesList as s (s.key)}
                                        <div class="flex items-center gap-1.5 font-mono text-xs">
                                            <span
                                                class="size-2 rounded-full"
                                                style="background-color: {s.color};"></span>
                                            <span class="text-text-muted">{s.label}:</span>
                                            <span class="font-semibold text-text-primary"
                                                >{data[s.key]}</span>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        {/snippet}
                    </Tooltip.Root>
                </Chart>
            {/if}
        </div>

        {#if seriesList.length > 1 && chartType !== 'pie' && chartType !== 'donut'}
            <div class="flex flex-wrap items-center gap-4 pt-2 text-xs">
                {#each seriesList as s (s.key)}
                    <div class="flex items-center gap-1.5">
                        <span
                            class="size-2.5 shrink-0 rounded-full"
                            style="background-color: {s.color};"></span>
                        <span class="text-text-secondary">{s.label}</span>
                    </div>
                {/each}
            </div>
        {/if}
    {/if}
</div>

<style>
    @reference "../../global.css";

    :global(.lc-axis-label, .lc-axis-tick-label) {
        @apply stroke-none! [stroke-width:0]!;
    }
</style>
