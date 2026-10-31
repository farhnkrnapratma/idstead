<script lang="ts">
    import { untrack, type Snippet } from 'svelte';
    import type { Attachment } from 'svelte/attachments';
    import { cn } from '../utils/cn';

    type Variant = 'linear' | 'flow' | 'conic';

    interface Props {
        children?: Snippet;
        colors?: string[];
        animationSpeed?: number;
        variant?: Variant;
        angle?: number;
        direction?: 'horizontal' | 'vertical' | 'diagonal';
        scale?: number;
        yoyo?: boolean;
        glow?: number;
        showBorder?: boolean;
        borderWidth?: number;
        pauseOnHover?: boolean;
        followPointer?: boolean;
        class?: string;
    }

    let {
        children,
        colors = ['var(--color-accent)', 'var(--color-discovery)', 'var(--color-fg-accent)'],
        animationSpeed = 8,
        variant = 'linear',
        angle = 90,
        direction,
        scale = 3,
        yoyo = true,
        glow = 0,
        showBorder = false,
        borderWidth = 1.5,
        pauseOnHover = false,
        followPointer = false,
        class: className = ''
    }: Props = $props();

    const ANGLES = { horizontal: 90, vertical: 180, diagonal: 135 } as const;
    const TAU = Math.PI * 2;

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

    const palette = $derived(
        colors.length > 1 ? colors : [colors[0] ?? 'currentColor', colors[0] ?? 'currentColor']
    );
    const resolvedAngle = $derived(direction ? ANGLES[direction] : angle);
    const settings = $derived({
        colors: palette,
        speed: Math.max(0.2, animationSpeed),
        variant,
        angle: resolvedAngle,
        scale: clamp(scale, 1, 6),
        yoyo,
        pauseOnHover,
        followPointer
    });
    const initialGradient = $derived(
        `linear-gradient(${resolvedAngle}deg, ${[...palette, palette[0]].join(', ')})`
    );

    let wake: (() => void) | null = null;

    $effect(() => {
        void settings;
        wake?.();
    });

    function reducedMotion() {
        const flag = document.documentElement.dataset.reduceMotion;
        if (flag === 'true') return true;
        if (flag === 'false') return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function gradient(
        s: typeof settings,
        state: { time: number; px: number; py: number; pull: number }
    ) {
        const list = s.colors;
        const cycle = state.time / s.speed;
        if (s.variant === 'flow') {
            const blobs = list.map((color, i) => {
                const spin = cycle * TAU;
                const rate = 0.55 + ((i * 0.618) % 1) * 0.5;
                let x = 50 + 44 * Math.sin(spin * rate + i * 2.1);
                let y = 50 + 40 * Math.sin(spin * (rate * 0.83 + 0.21) + i * 1.3);
                if (i === 0) {
                    x += (state.px * 100 - x) * state.pull;
                    y += (state.py * 100 - y) * state.pull;
                }
                return `radial-gradient(ellipse ${(22 + 12 * s.scale).toFixed(1)}% ${(60 + 30 * s.scale).toFixed(1)}% at ${x.toFixed(2)}% ${y.toFixed(2)}%, ${color} 0%, transparent 100%)`;
            });
            return `${blobs.join(', ')}, linear-gradient(${s.angle}deg, ${list.join(', ')})`;
        }
        if (s.variant === 'conic') {
            const sway = s.yoyo ? Math.sin(cycle * Math.PI) * 50 : cycle * 360;
            const cx = 50 + (state.px * 100 - 50) * state.pull;
            const cy = 260 + (state.py * 100 - 260) * state.pull;
            const stops = [...list, list[0]].map(
                (color, i) => `${color} ${((i / list.length) * 60 * (3 / s.scale)).toFixed(2)}deg`
            );
            return `repeating-conic-gradient(from ${(sway - 30).toFixed(2)}deg at ${cx.toFixed(2)}% ${cy.toFixed(2)}%, ${stops.join(', ')})`;
        }
        const loop = [...list, list[0]];
        const period = 100 * s.scale;
        let offset;
        if (s.yoyo) {
            const swing = cycle % 2;
            const t = swing < 1 ? swing : 2 - swing;
            offset = (0.5 - Math.cos(Math.PI * t) / 2) * (period - 100);
        } else {
            offset = (cycle % 1) * period;
        }
        offset += (state.px - 0.5) * period * 0.5 * state.pull;
        const stops = loop.map(
            (color, i) => `${color} ${((i / (loop.length - 1)) * period - offset).toFixed(2)}%`
        );
        return `repeating-linear-gradient(${s.angle}deg, ${stops.join(', ')})`;
    }

    const animate: Attachment<HTMLSpanElement> = root => {
        const state = {
            time: 0,
            inside: false,
            visible: true,
            x: 0.5,
            y: 0.5,
            px: 0.5,
            py: 0.5,
            vx: 0,
            vy: 0,
            pull: 0
        };
        let raf = 0;
        let last = 0;
        let alive = true;

        const paint = () => root.style.setProperty('--gt-gradient', gradient(settings, state));

        const tick = (now: number) => {
            raf = 0;
            if (!alive) return;
            const s = settings;
            const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
            last = now;
            const paused = reducedMotion() || (s.pauseOnHover && state.inside);
            if (!paused) state.time += dt;
            const target = s.followPointer && state.inside ? 1 : 0;
            state.pull += (target - state.pull) * (1 - Math.exp(-dt * 6));
            const stiffness = 160;
            state.vx +=
                ((state.x - state.px) * stiffness - state.vx * 2 * Math.sqrt(stiffness)) * dt;
            state.vy +=
                ((state.y - state.py) * stiffness - state.vy * 2 * Math.sqrt(stiffness)) * dt;
            state.px += state.vx * dt;
            state.py += state.vy * dt;
            paint();
            const settling =
                Math.abs(state.pull - target) > 0.001
                || Math.abs(state.vx) + Math.abs(state.vy) > 0.001;
            if (!state.visible || (paused && !settling)) return;
            raf = requestAnimationFrame(tick);
        };

        const start = () => {
            if (raf || !alive) return;
            last = performance.now();
            raf = requestAnimationFrame(tick);
        };
        wake = () => {
            paint();
            start();
        };

        const locate = (event: PointerEvent) => {
            const rect = root.getBoundingClientRect();
            state.x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
            state.y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
        };
        const onEnter = (event: PointerEvent) => {
            locate(event);
            if (!state.inside) {
                state.px = state.x;
                state.py = state.y;
            }
            state.inside = true;
            start();
        };
        const onMove = (event: PointerEvent) => {
            locate(event);
            start();
        };
        const onLeave = () => {
            state.inside = false;
            start();
        };

        const observer = new IntersectionObserver(entries => {
            state.visible = entries.some(entry => entry.isIntersecting);
            if (state.visible) start();
        });
        observer.observe(root);
        root.addEventListener('pointerenter', onEnter);
        root.addEventListener('pointermove', onMove);
        root.addEventListener('pointerleave', onLeave);
        untrack(paint);
        start();

        return () => {
            alive = false;
            cancelAnimationFrame(raf);
            observer.disconnect();
            root.removeEventListener('pointerenter', onEnter);
            root.removeEventListener('pointermove', onMove);
            root.removeEventListener('pointerleave', onLeave);
            wake = null;
        };
    };
</script>

<span
    {@attach animate}
    class={cn(
        'relative isolate inline-flex max-w-full items-center justify-center',
        showBorder
            && "px-[0.75em] py-[0.35em] before:pointer-events-none before:absolute before:inset-0 before:[background-image:var(--gt-gradient)] before:p-(--gt-border) before:content-[''] before:[mask:linear-gradient(#000_0_0)_content-box_exclude,linear-gradient(#000_0_0)]",
        className
    )}
    style:--gt-gradient={initialGradient}
    style:--gt-border="{borderWidth}px"
    style:--gt-glow={clamp(glow, 0, 1)}>
    <span class="relative inline-block">
        <span
            class="inline-block [background-image:var(--gt-gradient)] bg-clip-text text-transparent [-webkit-text-fill-color:transparent]">
            {@render children?.()}
        </span>
        {#if glow > 0}
            <span
                class="pointer-events-none absolute inset-0 -z-10 [background-image:var(--gt-gradient)] bg-clip-text text-transparent opacity-(--gt-glow) blur-[0.3em] saturate-[1.4] select-none [-webkit-text-fill-color:transparent]"
                aria-hidden="true">
                {@render children?.()}
            </span>
        {/if}
    </span>
</span>
