import { shortcutStore } from '#lib/stores/shortcutStore.svelte.ts';
import { platformStore } from '#lib/stores/platformStore.svelte.ts';
import { keyLabel } from '#lib/shortcuts.ts';

export interface ShortcutParams {
    combo?: string;
    group?: string;
    chordKey?: string;
    label?: string;
    scope?: string;
    disabled?: boolean;
    placement?: keyof typeof HINT_PLACEMENT;
}

export const KEY_GROUP_CLASS =
    'inline-flex shrink-0 items-stretch whitespace-nowrap font-mono text-3xs leading-none font-medium select-none';

export const KEY_SEGMENT_CLASS =
    'inline-flex h-4.5 min-w-4.5 items-center justify-center border px-1 transition-colors not-first:-ml-px first:rounded-l-sm last:rounded-r-sm';

const HINT_TONE = 'border-border-subtle/80 bg-surface-elevated text-text-primary';

const HINT_BASE = `pointer-events-none absolute z-10 rounded-sm shadow-xs ${KEY_GROUP_CLASS}`;

const HINT_PLACEMENT = {
    overhang: 'top-0 right-1.5 -translate-y-1/2',
    inline: 'top-1/2 right-1 -translate-y-1/2',
    trailing: 'top-1/2 right-8 -translate-y-1/2',
    after: 'top-1/2 left-full ml-1.5 -translate-y-1/2'
} as const;

const HINT_POSITIONS = {
    topEnd: HINT_PLACEMENT.overhang,
    topCenter: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
    bottomEnd: 'bottom-0 right-1.5 translate-y-1/2',
    bottomCenter: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
    aboveEnd: 'bottom-full right-0 mb-0.5',
    inline: HINT_PLACEMENT.inline,
    trailing: HINT_PLACEMENT.trailing,
    after: HINT_PLACEMENT.after
} as const;

type HintPosition = keyof typeof HINT_POSITIONS;

function candidatesFor(placement: keyof typeof HINT_PLACEMENT, narrow: boolean): HintPosition[] {
    if (placement === 'inline') return ['inline'];
    if (placement === 'trailing') return ['trailing'];
    if (placement === 'after') return ['after', 'aboveEnd', 'topEnd'];
    return narrow ?
            ['topCenter', 'bottomCenter', 'topEnd', 'bottomEnd', 'aboveEnd', 'after']
        :   ['topEnd', 'bottomEnd', 'topCenter', 'bottomCenter', 'aboveEnd', 'after'];
}

function textAt(x: number, y: number) {
    const doc = document as Document & {
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null;
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    const node =
        doc.caretPositionFromPoint?.(x, y)?.offsetNode
        ?? doc.caretRangeFromPoint?.(x, y)?.startContainer;
    if (node?.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) return false;
    const range = document.createRange();
    range.selectNodeContents(node);
    return [...range.getClientRects()].some(
        box => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom
    );
}

function coverage(badge: HTMLElement, rect: DOMRect) {
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const visibility = badge.style.visibility;
    badge.style.visibility = 'hidden';
    let score = 0;
    for (const fx of [0.15, 0.5, 0.85]) {
        for (const fy of [0.25, 0.75]) {
            const x = rect.left + rect.width * fx;
            const y = rect.top + rect.height * fy;
            if (x < 0 || y < 0 || x > width || y > height) {
                score += 400;
                continue;
            }
            if (textAt(x, y)) score += 100;
            const under = document.elementFromPoint(x, y);
            const control = under?.closest('a, button, input, textarea, select, [role="button"]');
            if (control && control !== badge.parentElement) score += 50;
        }
    }
    badge.style.visibility = visibility;
    return score;
}

function intersects(a: DOMRect, b: DOMRect) {
    return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

function clippedArea(badge: HTMLElement, rect: DOMRect) {
    let worst = 0;
    for (let el = badge.parentElement; el && el !== document.body; el = el.parentElement) {
        const style = getComputedStyle(el);
        if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
        const bounds = el.getBoundingClientRect();
        const width = Math.max(
            0,
            Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left)
        );
        const height = Math.max(
            0,
            Math.min(rect.bottom, bounds.bottom) - Math.max(rect.top, bounds.top)
        );
        worst = Math.max(worst, rect.width * rect.height - width * height);
    }
    return worst;
}

function collides(badge: HTMLElement, rect: DOMRect) {
    for (const other of document.querySelectorAll<HTMLElement>('[data-shortcut-hint]')) {
        if (other === badge || !other.isConnected) continue;
        const box = other.getBoundingClientRect();
        if (box.width && intersects(rect, box)) return true;
    }
    return false;
}

function badgeText(token: string, platform: typeof platformStore.current) {
    return token === 'Shift' ? '⇧' : keyLabel(token, platform).text;
}

function comboList(combo?: string): string[] {
    if (!combo) return [];
    return combo
        .split(',')
        .map(part => part.trim())
        .filter(Boolean);
}

function inheritedScope(node: HTMLElement): string {
    return node.closest('[data-shortcut-scope]')?.getAttribute('data-shortcut-scope') || 'page';
}

function resolveLabel(node: HTMLElement, label?: string): string {
    if (label) return label;
    return (
        node.getAttribute('aria-label')
        || node.getAttribute('title')
        || node.textContent?.trim().slice(0, 60)
        || 'Action'
    );
}

export function shortcut(node: HTMLElement, params: ShortcutParams = {}) {
    let id: string | null = null;
    let badge: HTMLElement | null = null;
    let rendered = '';
    let placedFor = '';
    let reservedPadding: string | null = null;
    let placement: keyof typeof HINT_PLACEMENT = params.placement ?? 'overhang';

    const detach = () => {
        if (id) shortcutStore.unregister(id);
        id = null;
    };

    const attach = (next: ShortcutParams) => {
        const combos = comboList(next.combo);
        if (!shortcutStore.enabled || next.disabled || (combos.length === 0 && !next.group)) {
            detach();
            renderHint();
            return;
        }

        const entry = {
            combos,
            group: next.group,
            chordKey: next.chordKey?.toLowerCase(),
            label: resolveLabel(node, next.label),
            scope: next.scope ?? inheritedScope(node),
            element: node
        };

        if (id) shortcutStore.update(id, entry);
        else id = shortcutStore.register(entry);
        renderHint();
    };

    const renderHint = () => {
        void shortcutStore.altHeld;
        void shortcutStore.leaderArmed;
        void shortcutStore.pendingGroup;
        const platform = platformStore.current;
        const parts = (id ? shortcutStore.hintFor(id) : []).map(token =>
            badgeText(token, platform)
        );
        if (parts.length === 0) {
            removeBadge();
            return;
        }
        if (!badge) {
            badge = document.createElement('span');
            badge.setAttribute('aria-hidden', 'true');
            badge.dataset.shortcutHint = '';
        }
        const signature = parts.join(' ');
        if (signature !== rendered) {
            badge.replaceChildren(
                ...parts.map(part => {
                    const segment = document.createElement('kbd');
                    segment.className = `${KEY_SEGMENT_CLASS} ${HINT_TONE}`;
                    segment.textContent = part;
                    return segment;
                })
            );
            rendered = signature;
        }
        const moved = badge.parentElement !== node;
        if (moved) node.appendChild(badge);
        if (moved || signature !== placedFor) place(signature);
    };

    const place = (signature: string) => {
        if (!badge) return;
        const current = badge;
        current.className = `${HINT_BASE} ${HINT_POSITIONS.topEnd}`;
        const narrow = current.offsetWidth > node.offsetWidth - 8;
        const options = candidatesFor(placement, narrow);
        let chosen = options[0];
        let best = Infinity;
        for (const option of options) {
            current.className = `${HINT_BASE} ${HINT_POSITIONS[option]}`;
            const rect = current.getBoundingClientRect();
            const score =
                (collides(current, rect) ? 1e6 : 0)
                + clippedArea(current, rect) * 10
                + (option === 'inline' ? 0 : coverage(current, rect));
            if (score < best) {
                best = score;
                chosen = option;
            }
            if (score === 0) break;
        }
        current.className = `${HINT_BASE} ${HINT_POSITIONS[chosen]}`;
        if (chosen === 'inline') {
            reservedPadding ??= node.style.paddingInlineEnd;
            node.style.paddingInlineEnd = `${current.offsetWidth + 8}px`;
        }
        placedFor = signature;
    };

    const removeBadge = () => {
        badge?.remove();
        badge = null;
        rendered = '';
        placedFor = '';
        if (reservedPadding !== null) {
            node.style.paddingInlineEnd = reservedPadding;
            reservedPadding = null;
        }
    };

    attach(params);

    const stopEffect = $effect.root(() => {
        $effect(() => {
            renderHint();
        });
    });

    return {
        update(next: ShortcutParams = {}) {
            const nextPlacement = next.placement ?? 'overhang';
            if (nextPlacement !== placement) placedFor = '';
            placement = nextPlacement;
            attach(next);
        },
        destroy() {
            stopEffect();
            removeBadge();
            detach();
        }
    };
}
