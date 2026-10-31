<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { cn } from '../utils/cn';

    interface Props {
        height?: string;
        width?: string;
        class?: string;
    }

    let { height = 'h-16', width = 'w-full', class: className = '' }: Props = $props();
</script>

<div
    aria-hidden="true"
    class={cn(
        'animate-pulse rounded-md bg-fg/6 opacity-100 select-none dark:bg-fg/8',
        height,
        width,
        className
    )}>
</div>
