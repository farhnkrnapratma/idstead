<!--
SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama

SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
    import { untrack } from 'svelte';
    import type { Attachment } from 'svelte/attachments';
    import type { HTMLImgAttributes } from 'svelte/elements';
    import type { ImageSource } from '../types';
    import { Image as ImageIcon, User as UserIcon } from '@lucide/svelte';
    import { cn } from '../utils/cn';
    import { elementRef } from '../utils/elementRef';

    interface Props {
        src?: string | null;
        alt: string;
        sources?: ImageSource[];
        class?: string;
        imgClass?: string;
        loading?: 'lazy' | 'eager';
        fetchpriority?: 'high' | 'low' | 'auto';
        referrerpolicy?: HTMLImgAttributes['referrerpolicy'];
        aspectRatio?: string;
        rounded?: string;
        variant?: 'image' | 'avatar';
        onload?: () => void;
        onerror?: () => void;
    }

    let {
        src = '',
        alt,
        sources,
        class: className = '',
        imgClass = '',
        loading = 'lazy',
        fetchpriority,
        referrerpolicy,
        aspectRatio,
        rounded = 'rounded-md',
        variant = 'image',
        onload,
        onerror
    }: Props = $props();

    const LEVELS = [48, 32, 20, 12, 8, 5, 3, 2, 1];
    const STAGE_MS = 40;
    const EDGE = 28;
    const STRIPS = 14;

    interface Fit {
        sx: number;
        sy: number;
        sw: number;
        sh: number;
        dx: number;
        dy: number;
        dw: number;
        dh: number;
    }

    let loadedSrc = $state<string | null>(null);
    let failedSrc = $state<string | null>(null);
    let sourcesFailed = $state(false);
    let refining = $state(false);
    let mosaic = $state(false);
    let resolved = $state(false);
    let canvasEl: HTMLCanvasElement | null = null;
    let imageEl: HTMLImageElement | null = null;

    const isError = $derived(!src || failedSrc === src);
    const useSources = $derived(Boolean(sources?.length) && !sourcesFailed);
    const isAvatar = $derived(variant === 'avatar');
    const loadingFrame = $derived(refining && !mosaic);

    function reducedMotion() {
        const flag = document.documentElement.dataset.reduceMotion;
        if (flag === 'true') return true;
        if (flag === 'false') return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function fit(img: HTMLImageElement, width: number, height: number): Fit {
        const style = getComputedStyle(img);
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const [px, py] = style.objectPosition
            .split(' ')
            .map(part => (part.endsWith('%') ? parseFloat(part) / 100 : 0.5));
        if (style.objectFit === 'contain') {
            const scale = Math.min(width / iw, height / ih);
            const dw = iw * scale;
            const dh = ih * scale;
            return {
                sx: 0,
                sy: 0,
                sw: iw,
                sh: ih,
                dx: (width - dw) * (px ?? 0.5),
                dy: (height - dh) * (py ?? 0.5),
                dw,
                dh
            };
        }
        const scale = Math.max(width / iw, height / ih);
        const sw = width / scale;
        const sh = height / scale;
        return {
            sx: (iw - sw) * (px ?? 0.5),
            sy: (ih - sh) * (py ?? 0.5),
            sw,
            sh,
            dx: 0,
            dy: 0,
            dw: width,
            dh: height
        };
    }

    function pixelLevels(img: HTMLImageElement, box: Fit, dpr: number) {
        return LEVELS.map(block => {
            if (block === 1) return null;
            const size = Math.max(2, Math.round(block * dpr));
            const small = document.createElement('canvas');
            small.width = Math.max(1, Math.round(box.dw / size));
            small.height = Math.max(1, Math.round(box.dh / size));
            const context = small.getContext('2d');
            if (context) {
                context.imageSmoothingQuality = 'high';
                context.drawImage(
                    img,
                    box.sx,
                    box.sy,
                    box.sw,
                    box.sh,
                    0,
                    0,
                    small.width,
                    small.height
                );
            }
            return small;
        });
    }

    function drawBand(
        context: CanvasRenderingContext2D,
        img: HTMLImageElement,
        level: HTMLCanvasElement | null,
        box: Fit,
        top: number,
        height: number
    ) {
        const y0 = Math.max(top, box.dy);
        const y1 = Math.min(top + height, box.dy + box.dh);
        if (y1 <= y0) return;
        const from = (y0 - box.dy) / box.dh;
        const span = (y1 - y0) / box.dh;
        if (level) {
            context.imageSmoothingEnabled = false;
            context.drawImage(
                level,
                0,
                from * level.height,
                level.width,
                span * level.height,
                box.dx,
                y0,
                box.dw,
                y1 - y0
            );
        } else {
            context.imageSmoothingEnabled = true;
            context.drawImage(
                img,
                box.sx,
                box.sy + from * box.sh,
                box.sw,
                span * box.sh,
                box.dx,
                y0,
                box.dw,
                y1 - y0
            );
        }
    }

    function refine(img: HTMLImageElement, canvas: HTMLCanvasElement) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width * dpr));
        const height = Math.max(1, Math.round(rect.height * dpr));
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context || !img.naturalWidth) {
            resolved = true;
            return;
        }
        const box = fit(img, width, height);
        const levels = pixelLevels(img, box, dpr);
        const steps = levels.length - 1;
        const rate = 1 / (steps * (STAGE_MS / 1000));
        const edge = EDGE * dpr;
        let progress = 0;
        let last = 0;

        const tick = (now: number) => {
            const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
            last = now;
            progress = Math.min(1, progress + rate * dt);
            const position = progress * steps;
            const index = Math.min(steps, Math.floor(position + 1e-6));
            const fraction = position - index;
            context.globalAlpha = 1;
            context.clearRect(0, 0, width, height);
            drawBand(context, img, levels[index], box, 0, height);
            if (index < steps && fraction > 0) {
                const front = fraction * (height + edge) - edge / 2;
                const top = Math.max(0, Math.floor(front - edge / 2));
                if (top > 0) drawBand(context, img, levels[index + 1], box, 0, top);
                const strip = edge / STRIPS;
                for (let k = 0; k < STRIPS; k += 1) {
                    const y = front - edge / 2 + k * strip;
                    if (y + strip <= 0 || y >= height) continue;
                    const t = 1 - (k + 0.5) / STRIPS;
                    context.globalAlpha = t * t * (3 - 2 * t);
                    drawBand(context, img, levels[index + 1], box, Math.max(0, y), strip);
                }
                context.globalAlpha = 1;
            }
            if (progress < 1) {
                requestAnimationFrame(tick);
                return;
            }
            levels.length = 0;
            resolved = true;
            setTimeout(() => (refining = false), 200);
        };
        requestAnimationFrame(tick);
    }

    function handleLoad() {
        loadedSrc = src ?? null;
        onload?.();
        if (!refining || !imageEl || !canvasEl) return;
        if (reducedMotion()) {
            resolved = true;
            return;
        }
        mosaic = true;
        refine(imageEl, canvasEl);
    }

    function handleError() {
        if (useSources) {
            sourcesFailed = true;
            return;
        }
        failedSrc = src ?? null;
        refining = false;
        onerror?.();
    }

    const track: Attachment<HTMLImageElement> = image => {
        imageEl = image;
        untrack(() => {
            if (image.complete && image.naturalWidth > 0) {
                refining = false;
                mosaic = false;
                resolved = false;
                if (loadedSrc !== src) handleLoad();
            } else {
                mosaic = false;
                resolved = false;
                refining = true;
            }
        });
        return () => {
            imageEl = null;
        };
    };
</script>

{#snippet image()}
    <img
        {@attach track}
        src={src || ''}
        {alt}
        {loading}
        {fetchpriority}
        {referrerpolicy}
        onload={handleLoad}
        onerror={handleError}
        class={cn('relative block h-full w-full object-cover', imgClass)} />
{/snippet}

{#snippet fallback()}
    <div
        class="absolute inset-0 flex h-full w-full items-center justify-center p-1 text-fg-muted select-none">
        {#if isAvatar}
            <UserIcon
                class="size-1/2 text-fg-muted"
                aria-hidden="true" />
        {:else}
            <ImageIcon
                class="size-8 text-fg-muted"
                aria-hidden="true" />
        {/if}
    </div>
{/snippet}

{#snippet picture()}
    <div
        class={cn(
            'relative h-full w-full transition duration-150 ease-out',
            loadingFrame && 'scale-102 opacity-85 blur-sm saturate-75',
            mosaic && !resolved && 'opacity-0'
        )}>
        {#if useSources}
            <picture>
                {#each sources ?? [] as source (source.type)}
                    <source
                        srcset={source.srcset}
                        type={source.type} />
                {/each}
                {@render image()}
            </picture>
        {:else}
            {@render image()}
        {/if}
    </div>
{/snippet}

{#snippet overlays()}
    {#if refining}
        <canvas
            {@attach elementRef<HTMLCanvasElement>(node => (canvasEl = node))}
            aria-hidden="true"
            class={cn(
                'pointer-events-none absolute inset-0 size-full opacity-0 transition-opacity duration-150 ease-out',
                mosaic && !resolved && 'opacity-100'
            )}></canvas>
    {/if}
    {#if loadingFrame}
        <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 refine-sweep">
        </div>
    {/if}
{/snippet}

<div
    class={cn(
        '@container relative isolate overflow-hidden bg-fg/6 select-none dark:bg-fg/8',
        rounded,
        aspectRatio,
        className
    )}>
    {#if isError || !src}
        {@render fallback()}
    {:else}
        {#key src}
            {@render picture()}
            {@render overlays()}
        {/key}
    {/if}
</div>
