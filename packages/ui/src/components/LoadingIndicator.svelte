<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { cn } from '../utils/cn';

    interface Props {
        size?: 'inline' | 'sm' | 'md' | 'lg';
        contained?: boolean;
        tone?: 'accent' | 'current';
        label?: string;
        decorative?: boolean;
        class?: string;
    }

    let {
        size = 'md',
        contained = false,
        tone = 'accent',
        label = 'Loading',
        decorative = false,
        class: className = ''
    }: Props = $props();

    const sizeStyles = { inline: 'size-[1.25em]', sm: 'size-6', md: 'size-12', lg: 'size-20' };
</script>

<span
    role={decorative ? undefined : 'progressbar'}
    aria-label={decorative ? undefined : label}
    aria-hidden={decorative ? 'true' : undefined}
    class={cn(
        'inline-grid shrink-0 place-items-center',
        sizeStyles[size],
        contained ? 'rounded-full bg-accent-subtle text-fg-accent'
        : tone === 'accent' ? 'text-accent'
        : '',
        className
    )}>
    <span class="block size-[79%] animate-loading-spin">
        <span class="block size-full animate-loading-morph bg-current"></span>
    </span>
</span>
