export interface ScrollBox {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
}

export function proportionalScrollTop(
    source: ScrollBox,
    target: Pick<ScrollBox, 'scrollHeight' | 'clientHeight'>
): number {
    const sourceRange = source.scrollHeight - source.clientHeight;
    const targetRange = target.scrollHeight - target.clientHeight;
    if (sourceRange <= 0 || targetRange <= 0) return 0;
    const progress = Math.min(1, Math.max(0, source.scrollTop / sourceRange));
    return Math.round(progress * targetRange);
}
