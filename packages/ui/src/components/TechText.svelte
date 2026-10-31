<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import type { Attachment } from 'svelte/attachments';
    import { cn } from '../utils/cn';
    import { createTechText, type TechTextSettings } from '../utils/techText';

    interface Props extends Partial<TechTextSettings> {
        class?: string;
        label?: string;
    }

    let {
        text = 'Idstead',
        fontFamily = '',
        fontWeight = 600,
        fontSize = 150,
        letterSpacing = -0.05,
        color = 'currentColor',
        accentColor = 'currentColor',
        align = 'center',
        reach = 200,
        softness = 0.7,
        dashLength = 4,
        dashGap = 2,
        strokeWidth = 1.5,
        lineStyle = 'dashed',
        reveal = 'letter',
        specks = 15,
        selection = true,
        labels = true,
        draggable = true,
        bounce = 0.4,
        sweep = true,
        speed = 1,
        clickKick = true,
        intro = 'none',
        introDuration = 2,
        guides = false,
        label,
        class: className = ''
    }: Props = $props();

    const settings = $derived<TechTextSettings>({
        text,
        fontFamily,
        fontWeight,
        fontSize,
        letterSpacing,
        color,
        accentColor,
        align,
        reach,
        softness,
        dashLength,
        dashGap,
        strokeWidth,
        lineStyle,
        reveal,
        specks,
        selection,
        labels,
        draggable,
        bounce,
        sweep,
        speed,
        clickKick,
        intro,
        introDuration,
        guides
    });

    let wake: (() => void) | null = null;

    $effect(() => {
        void settings;
        wake?.();
    });

    const engine: Attachment<HTMLCanvasElement> = canvas => {
        const container = canvas.parentElement;
        if (!container) return;
        const instance = createTechText(container, canvas, () => settings);
        wake = instance.wake;
        return () => {
            wake = null;
            instance.destroy();
        };
    };
</script>

<div
    class={cn('relative h-full w-full touch-pan-y select-none', className)}
    role="img"
    aria-label={label ?? text}>
    <canvas
        {@attach engine}
        class="block h-full w-full"></canvas>
</div>
