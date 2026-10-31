<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { cn } from '@idstead/ui/utils/cn.ts';
    import { activityTone, activityToneStyles } from './activityTone';

    let {
        kind,
        vote,
        class: className = ''
    }: { kind: string; vote?: string | null; class?: string } = $props();

    const style = $derived(activityToneStyles[activityTone(kind, vote)]);
    const Icon = $derived(style.icon);
</script>

<span
    aria-hidden="true"
    class={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-md border',
        style.class,
        className
    )}>
    <Icon class="size-4.5" />
</span>
