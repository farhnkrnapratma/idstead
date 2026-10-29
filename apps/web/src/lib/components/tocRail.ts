export interface RailItem {
    top: number;
    height: number;
    depth: number;
}

export interface RailSegment {
    start: number;
    length: number;
}

export interface RailGeometry {
    d: string;
    total: number;
    segments: RailSegment[];
}

const CURVE_SAMPLES = 16;

function railX(depth: number, step: number) {
    return depth * step + 1;
}

function curveLength(x1: number, y1: number, x2: number, y2: number) {
    const ym = (y1 + y2) / 2;
    let length = 0;
    let px = x1;
    let py = y1;
    for (let i = 1; i <= CURVE_SAMPLES; i++) {
        const t = i / CURVE_SAMPLES;
        const u = 1 - t;
        const x = u * u * u * x1 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x2;
        const y = u * u * u * y1 + 3 * u * u * t * ym + 3 * u * t * t * ym + t * t * t * y2;
        length += Math.hypot(x - px, y - py);
        px = x;
        py = y;
    }
    return length;
}

export function tocRail(items: readonly RailItem[], step = 16): RailGeometry {
    if (items.length === 0) return { d: '', total: 0, segments: [] };
    const parts: string[] = [];
    const segments: RailSegment[] = [];
    let total = 0;
    let previous: { x: number; y: number } | null = null;

    for (const item of items) {
        const x = railX(item.depth, step);
        const bottom = item.top + item.height;
        if (!previous) parts.push(`M ${x} ${item.top}`);
        else if (previous.x !== x) {
            const ym = (previous.y + item.top) / 2;
            parts.push(`C ${previous.x} ${ym}, ${x} ${ym}, ${x} ${item.top}`);
            total += curveLength(previous.x, previous.y, x, item.top);
        } else if (previous.y !== item.top) {
            parts.push(`L ${x} ${item.top}`);
            total += Math.abs(item.top - previous.y);
        }
        parts.push(`L ${x} ${bottom}`);
        segments.push({ start: total, length: item.height });
        total += item.height;
        previous = { x, y: bottom };
    }

    return { d: parts.join(' '), total, segments };
}
