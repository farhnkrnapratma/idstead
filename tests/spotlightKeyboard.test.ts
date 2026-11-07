// SPDX-FileCopyrightText: 2026 Farhan Kurnia Pratama
//
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test';
import { enterTarget, stepIndex } from '../apps/web/src/lib/components/spotlight/keyboard.ts';

describe('stepIndex', () => {
    test('moves down and wraps to the first entry', () => {
        expect(stepIndex('ArrowDown', 0, 3)).toBe(1);
        expect(stepIndex('ArrowDown', 2, 3)).toBe(0);
    });

    test('moves up and wraps to the last entry', () => {
        expect(stepIndex('ArrowUp', 2, 3)).toBe(1);
        expect(stepIndex('ArrowUp', 0, 3)).toBe(2);
    });
});

describe('enterTarget', () => {
    test('picks the highlighted history entry, then the highlighted result', () => {
        expect(enterTarget(1, 2, 3)).toEqual({ kind: 'history', index: 1 });
        expect(enterTarget(3, 2, 3)).toEqual({ kind: 'item', index: 1 });
    });

    test('falls back to the first history entry, then the first result', () => {
        expect(enterTarget(-1, 2, 3)).toEqual({ kind: 'history', index: 0 });
        expect(enterTarget(-1, 0, 3)).toEqual({ kind: 'item', index: 0 });
    });

    test('has no target when nothing is listed', () => {
        expect(enterTarget(-1, 0, 0)).toBeNull();
        expect(enterTarget(5, 0, 0)).toBeNull();
    });
});
