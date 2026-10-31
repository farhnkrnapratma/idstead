<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import type { Snippet } from 'svelte';
    import { cn } from '../utils/cn';

    interface Props {
        active?: boolean;
        disabled?: boolean;
        size?: 'sm' | 'md';
        onclick?: () => void;
        children?: Snippet;
        class?: string;
        title?: string;
        ariaLabel?: string;
    }

    let {
        active = false,
        disabled = false,
        size = 'md',
        onclick,
        children,
        class: className = '',
        title,
        ariaLabel
    }: Props = $props();

    const sizeStyles = {
        sm: 'px-2.5 py-1 text-xs gap-1.5',
        md: 'px-3.5 py-1.5 text-xs font-semibold gap-2'
    };
</script>

<button
    type="button"
    {disabled}
    {onclick}
    {title}
    aria-label={ariaLabel}
    aria-pressed={active}
    class={cn(
        'touch-target relative inline-flex cursor-pointer items-center justify-center rounded-md border transition-all select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-50',
        active ?
            'border-accent-strong bg-accent-strong font-bold text-on-accent shadow-xs'
        :   'border-line-subtle bg-surface text-fg-secondary hover:border-accent hover:bg-surface-hover hover:text-fg disabled:hover:border-line-subtle disabled:hover:bg-surface disabled:hover:text-fg-secondary',
        sizeStyles[size],
        className
    )}>
    {@render children?.()}
</button>
