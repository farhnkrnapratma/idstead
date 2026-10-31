<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import Badge from '@idstead/ui/components/Badge.svelte';
    import { isFeedbackActivity } from '#lib/adminActivity.ts';
    import { activityTone, activityToneStyles } from './activityTone';

    let {
        kind,
        vote,
        class: className = ''
    }: { kind: string; vote?: string | null; class?: string } = $props();

    const style = $derived(
        activityToneStyles[isFeedbackActivity({ kind }) ? 'feedback' : activityTone(kind, vote)]
    );
</script>

<Badge
    variant="custom"
    color={style.color}
    class={`font-normal whitespace-nowrap ${className}`}>
    {style.label}
</Badge>
