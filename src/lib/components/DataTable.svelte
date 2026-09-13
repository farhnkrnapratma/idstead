<script lang="ts">
  import type {Snippet} from 'svelte';
  import {cn} from '../utils/cn';

  interface Column {
    key: string;
    header: string;
    align?: 'left' | 'center' | 'right';
  }

  interface Props {
    caption?: string;
    columns: Column[];
    data: Record<string, unknown>[];
    class?: string;
    cell?: Snippet<[Record<string, unknown>, string]>;
  }

  let {
    caption = '',
    columns = [],
    data = [],
    cell,
    class: className = ''
  }: Props = $props();

  const alignStyles = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  };
</script>

<div
  class="w-full overflow-x-auto rounded-md border border-border-subtle shadow-xs select-none">
  <table
    class={cn('w-full border-collapse text-xs text-text-primary', className)}>
    {#if caption}
      <caption class="sr-only">{caption}</caption>
    {/if}
    <thead
      class="border-b border-border-subtle bg-surface-elevated text-xxs font-bold tracking-wider text-text-secondary uppercase">
      <tr>
        {#each columns as col (col.key)}
          <th
            scope="col"
            class={cn('px-4 py-3 font-bold', alignStyles[col.align || 'left'])}>
            {col.header}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody class="divide-y divide-border-subtle/50 bg-surface/50">
      {#each data as row, i (row.id ?? row.key ?? `${i}-${String(row[columns[0]?.key] ?? '')}`)}
        <tr class="transition-colors hover:bg-surface-hover">
          {#each columns as col (col.key)}
            <td
              class={cn(
                'px-4 py-3 font-medium',
                alignStyles[col.align || 'left']
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
