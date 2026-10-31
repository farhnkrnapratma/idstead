<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { Copy } from '@lucide/svelte';
    import IconButton from './IconButton.svelte';
    import { cn } from '../utils/cn';
    import { copyText } from '../utils/fileActions';

    interface Props {
        command: string;
        copyValue?: string;
        label?: string;
        class?: string;
    }

    let { command, copyValue, label = 'Command', class: className = '' }: Props = $props();
</script>

<div
    class={cn(
        'flex min-w-0 items-center gap-1 rounded-sm border border-line-subtle bg-surface py-1 pr-1 pl-3',
        className
    )}>
    <code
        class="min-w-0 flex-1 py-1 font-mono text-xs leading-5 wrap-break-word text-fg tabular-nums"
        >{command}</code>
    <IconButton
        ariaLabel="Copy {label.toLowerCase()}"
        variant="ghost"
        size="xs"
        class="shrink-0"
        onclick={() => copyText(copyValue ?? command, label)}>
        <Copy class="size-3.5" />
    </IconButton>
</div>
