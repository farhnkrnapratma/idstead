// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export type EnterTarget = { kind: 'history'; index: number } | { kind: 'item'; index: number };

export function stepIndex(key: 'ArrowDown' | 'ArrowUp', index: number, length: number): number {
    if (key === 'ArrowDown') return index < length - 1 ? index + 1 : 0;
    return index > 0 ? index - 1 : length - 1;
}

export function enterTarget(
    index: number,
    historyLength: number,
    itemLength: number
): EnterTarget | null {
    if (historyLength > 0 && index >= 0 && index < historyLength) {
        return { kind: 'history', index };
    }
    if (index >= historyLength && index < historyLength + itemLength) {
        return { kind: 'item', index: index - historyLength };
    }
    if (historyLength > 0) return { kind: 'history', index: 0 };
    if (itemLength > 0) return { kind: 'item', index: 0 };
    return null;
}
