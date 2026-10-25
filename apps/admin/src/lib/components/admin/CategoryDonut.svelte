<script lang="ts">
    import { ChartPie } from '@lucide/svelte';
    import { Chart, Svg, Pie, Arc, Tooltip } from 'layerchart';
    import { scaleOrdinal } from 'd3-scale';
    import { formatCount } from '#lib/adminWorkspace.ts';
    import EmptyState from '@idstead/ui/components/EmptyState.svelte';
    interface Segment {
        label: string;
        value: number;
        color: string;
    }
    let { segments, unit = 'responses' }: { segments: Segment[]; unit?: string } = $props();
    const series = $derived(segments.filter(row => row.value > 0));
    const total = $derived(series.reduce((sum, row) => sum + row.value, 0));
</script>

{#if total === 0}
    <EmptyState
        icon={ChartPie}
        title={`No ${unit} in this period`}
        description="Nothing to show for the selected range." />
{:else}
    <div class="flex flex-col items-center gap-6 py-4 sm:flex-row sm:justify-center">
        <div
            class="relative size-48 shrink-0"
            role="img"
            aria-label={`${formatCount(total)} ${unit}: ${series.map(row => `${row.value} ${row.label}`).join(', ')}`}>
            <Chart
                data={series}
                x="value"
                c="label"
                cScale={scaleOrdinal()}
                cRange={series.map(row => row.color)}>
                <Svg center>
                    <Pie
                        innerRadius={0.65}
                        padAngle={0}
                        cornerRadius={3}>
                        {#snippet children({ arcs })}
                            {#each arcs as arc (arc.data.label)}
                                <Arc
                                    startAngle={arc.startAngle}
                                    endAngle={arc.endAngle}
                                    innerRadius={0.65}
                                    padAngle={arc.padAngle}
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
                        {#if data}<div
                                class="rounded-md border border-line-subtle bg-surface px-3 py-2 text-xs shadow-md">
                                {data.label}: {formatCount(data.value)} · {Math.round(
                                    (data.value / total) * 100
                                )}%
                            </div>{/if}
                    {/snippet}
                </Tooltip.Root>
            </Chart>
            <div
                class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <strong class="text-2xl text-fg">{formatCount(total)}</strong>
                <span class="text-xs text-fg-muted">{unit}</span>
            </div>
        </div>
        <ul class="flex flex-col gap-3 text-sm">
            {#each series as row (row.label)}
                <li class="flex items-center gap-2">
                    <span
                        class="size-3 rounded-full"
                        style:background={row.color}
                        aria-hidden="true"></span
                    ><span>{row.label}:</span><strong>{formatCount(row.value)}</strong><span
                        class="text-fg-secondary">({Math.round((row.value / total) * 100)}%)</span>
                </li>
            {/each}
        </ul>
    </div>
{/if}
