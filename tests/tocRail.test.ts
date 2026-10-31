// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { tocRail } from '../apps/web/src/lib/components/tocRail.ts';

describe('tocRail', () => {
    test('is empty without headings', () => {
        expect(tocRail([])).toEqual({ d: '', total: 0, segments: [] });
    });

    test('draws one straight line through headings at the same depth', () => {
        const rail = tocRail([
            { top: 0, height: 30, depth: 0 },
            { top: 30, height: 30, depth: 0 }
        ]);
        expect(rail.d).toBe('M 1 0 L 1 30 L 1 60');
        expect(rail.segments).toEqual([
            { start: 0, length: 30 },
            { start: 30, length: 30 }
        ]);
        expect(rail.total).toBe(60);
    });

    test('curves into a deeper heading and counts the curve in the dash offsets', () => {
        const rail = tocRail([
            { top: 0, height: 30, depth: 0 },
            { top: 38, height: 30, depth: 1 }
        ]);
        expect(rail.d).toBe('M 1 0 L 1 30 C 1 34, 17 34, 17 38 L 17 68');
        const curve = rail.segments[1].start - 30;
        expect(curve).toBeGreaterThan(Math.hypot(16, 8));
        expect(curve).toBeLessThan(16 + 8);
        expect(rail.total).toBeCloseTo(rail.segments[1].start + 30);
    });
});
