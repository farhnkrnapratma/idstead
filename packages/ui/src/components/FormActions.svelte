<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import type { Snippet } from 'svelte';
    import { cn } from '../utils/cn';

    interface Props {
        align?: 'left' | 'center' | 'right' | 'between';
        class?: string;
        children?: Snippet;
    }

    let { align = 'right', class: className = '', children }: Props = $props();

    const alignStyles = {
        left: 'sm:justify-start',
        center: 'sm:justify-center',
        right: 'sm:justify-end',
        between: 'sm:justify-between'
    };
</script>

<div
    class={cn(
        'mt-4 flex flex-col gap-2.5 border-t border-line-subtle pt-3 sm:flex-row sm:items-center sm:gap-3 [&>a]:w-full sm:[&>a]:w-auto [&>button]:w-full sm:[&>button]:w-auto',
        alignStyles[align],
        className
    )}>
    {@render children?.()}
</div>
