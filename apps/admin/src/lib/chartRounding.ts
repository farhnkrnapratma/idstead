// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

export type SegmentRounding = 'all' | 'top' | 'bottom' | 'none';

export function segmentRounding(
    row: Record<string, unknown>,
    keys: string[],
    index: number
): SegmentRounding {
    const empty = (key: string) => !Number(row[key]);
    const top = keys.slice(index + 1).every(empty);
    const bottom = keys.slice(0, index).every(empty);
    if (top && bottom) return 'all';
    return (
        top ? 'top'
        : bottom ? 'bottom'
        : 'none'
    );
}
