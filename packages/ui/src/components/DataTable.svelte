<script
    module
    lang="ts">
    export interface DataTableColumn {
        key: string;
        header: string;
        srHeader?: string;
        align?: 'left' | 'center' | 'right';
        width?: string;
        class?: string;
    }
</script>

<script lang="ts">
    import type { Snippet } from 'svelte';
    import { cn } from '../utils/cn';

    type Column = DataTableColumn;

    interface Props {
        title?: string;
        caption?: string;
        columns: Column[];
        data: Record<string, unknown>[];
        class?: string;
        cell?: Snippet<[Record<string, unknown>, string]>;
        header?: Snippet;
        meta?: Snippet;
        toolbar?: Snippet;
        footer?: Snippet;
        state?: Snippet;
        onRowSelect?: (row: Record<string, unknown>) => void;
        rowClass?: (row: Record<string, unknown>) => string;
    }

    let {
        title = '',
        caption = '',
        columns = [],
        data = [],
        cell,
        header,
        meta,
        toolbar,
        footer,
        state,
        onRowSelect,
        rowClass,
        class: className = ''
    }: Props = $props();

    const alignStyles = { left: 'text-left', center: 'text-center', right: 'text-right' };

    const fixed = $derived(columns.some(col => col.width));

    function selectRow(row: Record<string, unknown>, event: MouseEvent) {
        if ((event.target as HTMLElement | null)?.closest('a,button,input,label')) return;
        onRowSelect?.(row);
    }

    function selectRowFromKey(row: Record<string, unknown>, event: KeyboardEvent) {
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' '))
            return;
        event.preventDefault();
        onRowSelect?.(row);
    }
</script>

<div class="w-full overflow-hidden rounded-md glass-card border border-border-subtle shadow-sm">
    {#if header || title || meta}
        <div
            class={cn(
                'flex min-h-10 flex-wrap items-center gap-1.5 px-4 py-1',
                !toolbar && 'border-b border-border-subtle'
            )}>
            {#if title}
                <h2 class="min-w-0 truncate type-card-title">
                    {title}
                </h2>
            {/if}
            {#if title && meta}
                <span
                    class="text-text-muted"
                    aria-hidden="true">·</span>
            {/if}
            {#if meta}{@render meta()}{/if}
            {#if header}{@render header()}{/if}
        </div>
    {/if}
    {#if toolbar}{@render toolbar()}{/if}
    {#if state}
        <div class="px-4 py-3">{@render state()}</div>
    {:else}
        <div class="w-full overflow-x-auto">
            <table
                class={cn(
                    'w-full border-separate border-spacing-0 text-xs text-text-primary',
                    fixed && 'table-fixed',
                    className
                )}>
                {#if caption}
                    <caption class="sr-only">{caption}</caption>
                {/if}
                <colgroup>
                    {#each columns as col (col.key)}
                        <col style:width={col.width} />
                    {/each}
                </colgroup>
                <thead>
                    <tr>
                        {#each columns as col (col.key)}
                            <th
                                scope="col"
                                class={cn(
                                    'h-9 border-b border-border-subtle px-3 text-xs font-semibold tracking-wide text-text-primary first:pl-4 last:pr-4',
                                    alignStyles[col.align || 'left'],
                                    col.class
                                )}>
                                {#if col.header}{col.header}{:else if col.srHeader}<span
                                        class="sr-only">{col.srHeader}</span
                                    >{/if}
                            </th>
                        {/each}
                    </tr>
                </thead>
                <tbody>
                    {#each data as row, i (row.id ?? row.key ?? `${i}-${String(row[columns[0]?.key] ?? '')}`)}
                        <tr
                            class={cn(
                                'transition-colors hover:bg-surface-hover',
                                onRowSelect
                                    && 'cursor-pointer focus-visible:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring',
                                rowClass?.(row)
                            )}
                            tabindex={onRowSelect ? 0 : undefined}
                            onclick={onRowSelect ? event => selectRow(row, event) : undefined}
                            onkeydown={onRowSelect ?
                                event => selectRowFromKey(row, event)
                            :   undefined}>
                            {#each columns as col (col.key)}
                                <td
                                    class={cn(
                                        'h-9 overflow-hidden px-3 py-0 font-normal text-ellipsis whitespace-nowrap text-text-secondary first:pl-4 last:pr-4',
                                        i > 0 && 'border-t border-border-subtle',
                                        alignStyles[col.align || 'left'],
                                        col.class
                                    )}>
                                    {#if cell}{@render cell(row, col.key)}{:else}{row[col.key]
                                            ?? '—'}{/if}
                                </td>
                            {/each}
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
    {#if footer}
        <div
            class="flex min-h-10 flex-wrap items-center justify-end gap-2 border-t border-border-subtle px-4 py-1">
            {@render footer()}
        </div>
    {/if}
</div>
