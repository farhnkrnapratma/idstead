<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { Calendar, Chart, Rect, Layer, Tooltip } from 'layerchart';
    import { scaleThreshold } from 'd3-scale';
    import { ChevronLeft, ChevronRight, CalendarDays } from '@lucide/svelte';
    import {
        calendarWeekColumns,
        formatCount,
        hasChartActivity,
        type WorkspaceCalendar
    } from '#lib/adminWorkspace.ts';
    import { formatAdminDate } from '#lib/adminDateFormat.ts';
    import { adminDisplayStore } from '../../stores/adminDisplayStore.svelte.ts';
    import { pluralize } from '@idstead/domain/pluralize.ts';
    import IconButton from '@idstead/ui/components/IconButton.svelte';
    import EmptyState from '@idstead/ui/components/EmptyState.svelte';
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
    const hasActivity = $derived(hasChartActivity(data.days.map(row => row.views)));
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
    const chartPadding = { top: 20, left: 48 };
    const fallbackHeight = 160;
    let width = $state(0);
    const cellSize = $derived(
        width > chartPadding.left ? (width - chartPadding.left) / calendarWeekColumns(data.year) : 0
    );
    const chartHeight = $derived(
        cellSize > 0 ? Math.round(cellSize * 7 + chartPadding.top) : fallbackHeight
    );
</script>

<div class="flex min-w-0 flex-col gap-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-col gap-0.5">
            <h2 class="type-card-title">Article views</h2>
            <p class="text-xs text-fg-muted">
                Cumulative visits across all pages over the past year.
            </p>
        </div>
        <div class="flex items-center gap-3">
            {#if hasActivity}
                <div
                    class="flex items-center gap-1 text-xs text-fg-muted"
                    role="img"
                    aria-label="Color intensity increases with daily views">
                    <span class="mr-1">Less</span>
                    {#each colors as color (color)}<span
                            class="size-3 rounded-sm"
                            style:background={color}
                            aria-hidden="true"></span
                        >{/each}
                    <span class="ml-1">More</span>
                </div>
            {/if}
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
    {#if hasActivity}
        <div
            class="views-calendar-chart"
            bind:clientWidth={width}
            role="img"
            aria-label={`Daily article views for ${data.year}. Hover a day for its exact value.`}>
            <Chart
                data={days}
                x="date"
                c="views"
                cScale={scaleThreshold<number, string>().unknown('var(--color-calendar-0)')}
                cDomain={thresholds}
                cRange={colors}
                padding={chartPadding}
                height={chartHeight}>
                {#snippet children({ context })}
                    <Layer>
                        <Calendar
                            {start}
                            {end}
                            tooltip
                            monthLabel={{ fill: 'var(--color-fg-muted)', fontSize: 12 }}>
                            {#snippet children({ cells, cellSize })}
                                {#each dayLabels as label, i (label)}
                                    <text
                                        x={-20}
                                        y={i * cellSize[1] + cellSize[1] / 2}
                                        fill="var(--color-fg-muted)"
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
                                        fill={cell.color ?? 'var(--color-calendar-0)'}
                                        onpointermove={e => context.tooltip?.show(e, cell.data)}
                                        onpointerleave={() => context.tooltip?.hide()} />
                                {/each}
                            {/snippet}
                        </Calendar>
                    </Layer>
                    <Tooltip.Root variant="none">
                        {#snippet children({ data: day })}
                            {#if day?.views != null}
                                <div
                                    class="rounded-md border border-line-subtle bg-surface px-3 py-2 text-xs shadow-md">
                                    <p class="text-fg-secondary">{day.label}</p>
                                    <p class="font-semibold text-fg-accent">
                                        {pluralize(day.views, 'view', undefined, formatCount)}
                                    </p>
                                </div>
                            {/if}
                        {/snippet}
                    </Tooltip.Root>
                {/snippet}
            </Chart>
        </div>
    {:else}
        <EmptyState
            icon={CalendarDays}
            title="No views in this period"
            description="There are no article views to display for this year." />
    {/if}
</div>
